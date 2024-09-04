import { ClientReqLock, ClientSub, Filter, MessageError, MessageFailure, MessageFree, MessageInput, MessageLock, MessageOutput, MessageSuccess, MutexoMessage, mutexoMessageFromCborObj } from "@harmoniclabs/mutexo-messages";
import { isObject } from "@harmoniclabs/obj-utils";
import { CborArray } from "@harmoniclabs/cbor";
import { eventNameToMutexoEventIndex } from "./utils";
import { CanBeTxOutRef, forceTxOutRef } from "@harmoniclabs/cardano-ledger-ts";

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

export interface IMutexoClient {
    addEventListener( evt: "free"   , listener: MutexoClientEvtListener ): this
    addEventListener( evt: "lock"   , listener: MutexoClientEvtListener ): this
    addEventListener( evt: "input"  , listener: MutexoClientEvtListener ): this
    addEventListener( evt: "output" , listener: MutexoClientEvtListener ): this
    addEventListener( evt: "success", listener: MutexoClientEvtListener ): this
    addEventListener( evt: "failure", listener: MutexoClientEvtListener ): this
    addEventListener( evt: "error"  , listener: MutexoClientEvtListener ): this

    addListener( evt: "free"   , listener: MutexoClientEvtListener ): this
    addListener( evt: "lock"   , listener: MutexoClientEvtListener ): this
    addListener( evt: "input"  , listener: MutexoClientEvtListener ): this
    addListener( evt: "output" , listener: MutexoClientEvtListener ): this
    addListener( evt: "success", listener: MutexoClientEvtListener ): this
    addListener( evt: "failure", listener: MutexoClientEvtListener ): this
    addListener( evt: "error"  , listener: MutexoClientEvtListener ): this

    on( evt: "free"   , listener: MutexoClientEvtListener ): this
    on( evt: "lock"   , listener: MutexoClientEvtListener ): this
    on( evt: "input"  , listener: MutexoClientEvtListener ): this
    on( evt: "output" , listener: MutexoClientEvtListener ): this
    on( evt: "success", listener: MutexoClientEvtListener ): this
    on( evt: "failure", listener: MutexoClientEvtListener ): this
    on( evt: "error"  , listener: MutexoClientEvtListener ): this

    // once( evt: "free"   , listener: MutexoClientEvtListener ): this
    // once( evt: "lock"   , listener: MutexoClientEvtListener ): this
    // once( evt: "input"  , listener: MutexoClientEvtListener ): this
    // once( evt: "output" , listener: MutexoClientEvtListener ): this
    // once( evt: "success", listener: MutexoClientEvtListener ): this
    // once( evt: "failure", listener: MutexoClientEvtListener ): this
    // once( evt: "error"  , listener: MutexoClientEvtListener ): this

    removeEventListener( evt: "free"   , listener: MutexoClientEvtListener ): this
    removeEventListener( evt: "lock"   , listener: MutexoClientEvtListener ): this
    removeEventListener( evt: "input"  , listener: MutexoClientEvtListener ): this
    removeEventListener( evt: "output" , listener: MutexoClientEvtListener ): this
    removeEventListener( evt: "success", listener: MutexoClientEvtListener ): this
    removeEventListener( evt: "failure", listener: MutexoClientEvtListener ): this
    removeEventListener( evt: "error"  , listener: MutexoClientEvtListener ): this

    removeListener( evt: "free"   , listener: MutexoClientEvtListener ): this
    removeListener( evt: "lock"   , listener: MutexoClientEvtListener ): this
    removeListener( evt: "input"  , listener: MutexoClientEvtListener ): this
    removeListener( evt: "output" , listener: MutexoClientEvtListener ): this
    removeListener( evt: "success", listener: MutexoClientEvtListener ): this
    removeListener( evt: "failure", listener: MutexoClientEvtListener ): this
    removeListener( evt: "error"  , listener: MutexoClientEvtListener ): this

    off( evt: "free"    , listener: MutexoClientEvtListener ): this
    off( evt: "lock"    , listener: MutexoClientEvtListener ): this
    off( evt: "input"   , listener: MutexoClientEvtListener ): this
    off( evt: "output"  , listener: MutexoClientEvtListener ): this
    off( evt: "success" , listener: MutexoClientEvtListener ): this
    off( evt: "failure" , listener: MutexoClientEvtListener ): this
    off( evt: "error"   , listener: MutexoClientEvtListener ): this

    removeAllListeners( evt?: MutexoClientEvtName ): this

    emit( evt: "free"   , msg: MessageFree ): boolean
    emit( evt: "lock"   , msg: MessageLock ): boolean
    emit( evt: "input"  , msg: MessageInput ): boolean
    emit( evt: "output" , msg: MessageOutput ): boolean
    emit( evt: "success", msg: MessageSuccess ): boolean
    emit( evt: "failure", msg: MessageFailure ): boolean
    emit( evt: "error"  , msg: MessageError ): boolean

    dispatchEvent( evt: "free"   , msg: MessageFree ): boolean
    dispatchEvent( evt: "lock"   , msg: MessageLock ): boolean
    dispatchEvent( evt: "input"  , msg: MessageInput ): boolean
    dispatchEvent( evt: "output" , msg: MessageOutput ): boolean
    dispatchEvent( evt: "success", msg: MessageSuccess ): boolean
    dispatchEvent( evt: "failure", msg: MessageFailure ): boolean
    dispatchEvent( evt: "error"  , msg: MessageError ): boolean
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
                // TODO: eventNameToMutexoEventIndex
                eventType: eventNameToMutexoEventIndex( eventName ),
                filters
            }).toCbor().toBuffer()
        );
    }

    async unsub(): Promise<void>
    {
        await this.waitWsReady();

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

        return new Promise<MessageSuccess | MessageFailure>((resolve, reject) => {
            function handleSucces( msg: MessageSuccess )
            {
                self.off( "success", handleSucces );
                self.off( "failure", handleFailure );
                resolve( msg );
            }
            function handleFailure( msg: MessageFailure )
            {
                self.off( "success", handleSucces );
                self.off( "failure", handleFailure );
                resolve( msg );
            }

            self.on( "success", handleSucces );
            self.on( "failure", handleFailure );
            self.webSocket.send(
                new ClientReqLock({
                    utxoRefs: utxoRefs.map( forceTxOutRef ),
                    required
                }).toCbor().toBuffer()
            );
        });
    }

    async free(): Promise<void>
    {
        await this.waitWsReady();

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

function parseMutexoMessage( stuff: any ): MutexoMessage
{
    if(!( 
        isObject( stuff ) &&
        stuff instanceof CborArray 
    )) throw new Error( "Invalid message" );

    return mutexoMessageFromCborObj( stuff );
}