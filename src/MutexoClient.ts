import { ClientReqFree, ClientReqLock, ClientSub, ClientUnsub, Filter, MessageError, MessageFailure, MessageFree, MessageInput, MessageLock, MessageOutput, MessageSuccess, MutexoMessage } from "@harmoniclabs/mutexo-messages";
import { CanBeTxOutRef, forceTxOutRef } from "@harmoniclabs/cardano-ledger-ts";
import { eventNameToMutexoEventIndex, parseMutexoMessage } from "./utils";

type MutexoClientEvtListener = ( msg: MutexoMessage ) => void;

type MutexoClientEvtListeners = {
    free: MutexoClientEvtListener[],
    lock: MutexoClientEvtListener[],
    input: MutexoClientEvtListener[],
    output: MutexoClientEvtListener[],
    success: MutexoClientEvtListener[],
    failure: MutexoClientEvtListener[],
    error: MutexoClientEvtListener[]
};

type MutexoClientEvtName = keyof MutexoClientEvtListeners & string;

type EvtListenerOf<EvtName extends MutexoClientEvtName> = 
    EvtName extends "free"      ? ( msg: MessageFree ) => void :
    EvtName extends "lock"      ? ( msg: MessageLock ) => void :
    EvtName extends "input"     ? ( msg: MessageInput ) => void :
    EvtName extends "output"    ? ( msg: MessageOutput ) => void :
    EvtName extends "success"   ? ( msg: MessageSuccess ) => void :
    EvtName extends "failure"   ? ( msg: MessageFailure ) => void :
    EvtName extends "error"     ? ( msg: MessageError ) => void :
    never;

type DataOf<EvtName extends MutexoClientEvtName> =
    EvtName extends "free"      ? MessageFree :
    EvtName extends "lock"      ? MessageLock :
    EvtName extends "input"     ? MessageInput :
    EvtName extends "output"    ? MessageOutput :
    EvtName extends "success"   ? MessageSuccess :
    EvtName extends "failure"   ? MessageFailure :
    EvtName extends "error"     ? MessageError :
    never;

function isMutexoClientEvtName( stuff: any ): stuff is MutexoClientEvtName
{
    return (
        stuff === "free"    ||
        stuff === "lock"    ||
        stuff === "input"   ||
        stuff === "output"  ||
        stuff === "success" ||
        stuff === "failure" ||
        stuff === "error"
    );
}

function msgToName( msg: MutexoMessage ): MutexoClientEvtName | undefined
{
    if( msg instanceof MessageFree )        return "free";
    if( msg instanceof MessageLock )        return "lock";
    if( msg instanceof MessageInput )       return "input";
    if( msg instanceof MessageOutput )      return "output";
    if( msg instanceof MessageSuccess )     return "success";
    if( msg instanceof MessageFailure )     return "failure";
    if( msg instanceof MessageError )       return "error";

    return undefined;
}

const PENDING_IDS: number[] = [];

function getUniqueId(): number
{
    let id: number;
    while(
        !PENDING_IDS.includes(
            id = Math.floor( Math.random() * Number.MAX_SAFE_INTEGER )
        )
    ) {}
    PENDING_IDS.push( id );
    return id;
}

function releaseUniqueId( id: number )
{
    const idx = PENDING_IDS.indexOf( id );
    if( idx < 0 ) return;
    void PENDING_IDS.splice( idx, 1 );
}
 
export class MutexoClient
{
    private readonly webSocket: WebSocket;

    private eventListeners: Record<MutexoClientEvtName, MutexoClientEvtListener[]> = Object.freeze({
        free: [],
        lock: [],
        input: [],
        output: [],
        success: [],
        failure: [],
        error: []
    });

    private _wsReady: boolean;
    async waitWsReady(): Promise<void>
    {
        if( this._wsReady ) return;

        return new Promise( ( resolve ) => {
            this.webSocket.addEventListener(
                "open",
                () => {
                    this._wsReady = true;
                    resolve();
                }, { once: true }
            );
        });
    }

    constructor( webSocket: WebSocket )
    {
        this.webSocket = webSocket;
        this.webSocket.binaryType = "arraybuffer";
        this._wsReady = this.webSocket.readyState === WebSocket.OPEN;

        if( !this._wsReady )
        {
            this.webSocket.addEventListener(
                "open",
                () => {
                    this._wsReady = true;
                }, { once: true }
            );
        }

        this.webSocket.addEventListener( "close", ( evt ) => { throw new Error("web socket closed unexpectedly"); });
        this.webSocket.addEventListener( "error", ( evt ) => { throw new Error("web socket errored"); });

        this.webSocket.addEventListener( "message", async ({ data }) => {
            let bytes: Uint8Array;

            if( data instanceof Blob ) data = await data.arrayBuffer();
            
            if( data instanceof ArrayBuffer ) bytes = new Uint8Array( data );
            else if( data instanceof Uint8Array ) bytes = data;
            else throw new Error( "Invalid data type" );

            const msg = parseMutexoMessage( bytes );

            const name = msgToName( msg );
            if( typeof name !== "string" ) throw new Error( "Invalid message" );

            this.dispatchEvent( name, msg as any );
        });
    }

    async sub(
        eventName: MutexoClientEvtName,
        filters: Filter[] = []
    ): Promise<void>
    {
        await this.waitWsReady();

        this.webSocket.send(
            new ClientSub({
                id: getUniqueId(),
                eventType: eventNameToMutexoEventIndex( eventName ),
                filters
            }).toCbor().toBuffer()
        );
    }

    async unsub(
        eventName: MutexoClientEvtName,
        filters: Filter[] = []
    ): Promise<void>
    {
        await this.waitWsReady();

        this.webSocket.send(
            new ClientUnsub({
                id: getUniqueId(),
                eventType: eventNameToMutexoEventIndex( eventName ),
                filters
            }).toCbor().toBuffer()
        );
    }

    async lock(
        utxoRefs: CanBeTxOutRef[],
        required: number = 1
    ): Promise<MessageSuccess | MessageFailure>
    {
        await this.waitWsReady();

        if(!(
            Number.isSafeInteger( required ) &&
            required > 0
        )) required = 1;

        const self = this;

        const id = getUniqueId();

        return new Promise<MessageSuccess | MessageFailure>((resolve, reject) => {
            function handleSuccess( msg: MessageSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off( "success", handleSuccess );
                self.off( "failure", handleFailure );
                resolve( msg );
            }
            function handleFailure( msg: MessageFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off( "success", handleSuccess );
                self.off( "failure", handleFailure );
                resolve( msg );
            }

            self.on( "success", handleSuccess );
            self.on( "failure", handleFailure );
            self.webSocket.send(
                new ClientReqLock({
                    id,
                    utxoRefs: utxoRefs.map( forceTxOutRef ),
                    required
                }).toCbor().toBuffer()
            );
        });
    }

    async free( 
        utxoRefs: CanBeTxOutRef[] 
    ): Promise<MessageSuccess | MessageFailure>
    {
        await this.waitWsReady();

        const self = this;

        const id = getUniqueId();

        return new Promise<MessageSuccess | MessageFailure>((resolve, reject) => {
            function handleSuccess( msg: MessageSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off( "success", handleSuccess );
                self.off( "failure", handleFailure );
                resolve( msg );
            }
            function handleFailure( msg: MessageFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off( "success", handleSuccess );
                self.off( "failure", handleFailure );
                resolve( msg );
            }

            self.on( "success", handleSuccess );
            self.on( "failure", handleFailure );
            self.webSocket.send(
                new ClientReqFree({
                    id,
                    utxoRefs: utxoRefs.map( forceTxOutRef )
                }).toCbor().toBuffer()
            );
        });
    }

    addEventListener( evt: MutexoClientEvtName, callback: ( data: any ) => void ): this
    {
        return this.on( evt, callback );
    }
    addListener( evt: MutexoClientEvtName, callback: ( data: any ) => void ): this
    {
        return this.on( evt, callback );
    }
    on( evt: MutexoClientEvtName, callback: ( data: any ) => void ): this
    {
        const listeners = this.eventListeners[ evt ];
        if( !listeners ) return this;

        listeners.push( callback );
        
        return this;
    }

    removeEventListener( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {
        return this.off( evt, callback );
    }
    removeistener( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {
        return this.off( evt, callback );
    }
    off( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {
        const listeners = this.eventListeners[ evt ];
        if( !listeners ) return this;

        const idx = listeners.findIndex(( cb ) => callback === cb );
        if( idx < 0 ) return this; // not found, do nothing

        void listeners.splice( idx, 1 );

        return this;
    }

    emit<EvtName extends MutexoClientEvtName>( evt: EvtName, msg: DataOf<EvtName> ): boolean
    {
        return this.dispatchEvent( evt, msg );
    }
    dispatchEvent<EvtName extends MutexoClientEvtName>( evt: EvtName, msg: DataOf<EvtName> ): boolean
    {
        const listeners = this.eventListeners[ evt ];
        if( !listeners ) return false;

        for( const listener of listeners )
        {
            listener( msg );
        }

        return true;
    }

    removeAllListeners( event?: MutexoClientEvtName ): this
    {
        return this.clearListeners( event );
    }
    clearListeners( event?: MutexoClientEvtName ): this
    {
        if( isMutexoClientEvtName( event ) )
        {
            this.eventListeners[ event ] = [];
        }
        else
        {
            this.eventListeners = {
                free: [],
                lock: [],
                input: [],
                output: [],
                success: [],
                failure: [],
                error: []
            };
        }

        return this;
    }

}