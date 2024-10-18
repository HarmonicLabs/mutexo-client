import { ClientReqFree, ClientReqLock, ClientSub, ClientUnsub, Filter, MessageError, MessageMutexFailure, MessageFree, MessageInput, MessageLock, MessageOutput, MessageMutexSuccess, MutexoMessage } from "@harmoniclabs/mutexo-messages";
import { MessageSubFailure } from "@harmoniclabs/mutexo-messages/dist/messages/MessageSubFailure";
import { MessageSubSuccess } from "@harmoniclabs/mutexo-messages/dist/messages/MessageSubSuccess";
import { parseMutexoMessage } from "@harmoniclabs/mutexo-messages/dist/utils/parsers";
import { CanBeTxOutRef, forceTxOutRef } from "@harmoniclabs/cardano-ledger-ts";
import { eventNameToMutexoEventIndex, msgToName } from "./utils/mutexEvents";
import { getUniqueId, releaseUniqueId } from "./utils/ids";
import WebSocket from "ws";

export type MutexoClientEvtName = keyof MutexoClientEvtListeners & string;

type MutexoClientEvtListeners = {
    free:           MutexoClientEvtListener[],
    lock:           MutexoClientEvtListener[],
    input:          MutexoClientEvtListener[],
    output:         MutexoClientEvtListener[],
    mtxSuccess:     MutexoClientEvtListener[],
    mtxFailure:     MutexoClientEvtListener[],
    error:          MutexoClientEvtListener[],
    subSuccess:     MutexoClientEvtListener[],
    subFailure:     MutexoClientEvtListener[]
};

type MutexoClientEvtListener = ( msg: MutexoMessage ) => void;

type DataOf<EvtName extends MutexoClientEvtName> =
    EvtName extends "free"          ? MessageFree 			:
    EvtName extends "lock"          ? MessageLock 			:
    EvtName extends "input"         ? MessageInput 			:
    EvtName extends "output"        ? MessageOutput 		:
    EvtName extends "mtxSuccess"    ? MessageMutexSuccess 	:
    EvtName extends "mtxFailure"    ? MessageMutexFailure 	:
    EvtName extends "error"         ? MessageError 			:
    EvtName extends "subSuccess"    ? MessageSubSuccess 	:
    EvtName extends "subFailure"    ? MessageSubFailure 	:
    never;

function isMutexoClientEvtName( stuff: any ): stuff is MutexoClientEvtName
{
    return (
        stuff === "free"        ||
        stuff === "lock"        ||
        stuff === "input"       ||
        stuff === "output"      ||
        stuff === "mtxSuccess"  ||
        stuff === "mtxFailure"  ||
        stuff === "error"       ||
        stuff === "subSuccess"  ||
        stuff === "subFailure"
    );
}
 
export class MutexoClient
{
    private readonly webSocket: WebSocket;

    private eventListeners: Record<MutexoClientEvtName, MutexoClientEvtListener[]> = Object.freeze({
        free: 		[],
        lock: 		[],
        input: 		[],
        output: 	[],
        mtxSuccess: [],
        mtxFailure: [],
        error: 		[],
        subSuccess: [],
        subFailure: []
    });

    private _wsReady: boolean;
    async waitWsReady(): Promise<void>
    {
        if( this._wsReady ) return;

        return new Promise(( resolve ) => {
            this.webSocket.addEventListener("open", () => {
				this._wsReady = true;
				resolve();
			}, 
			{ 
				once: true 
			});
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

        this.webSocket.addEventListener("close", ( evt ) => { 
			//debug
			var rndm = Math.floor( Math.random() * 1000 );
			console.log("!- CLIENT WEBSOCKET CLOSING FOR REASON: [", rndm,"] -!\n");
			console.log("> [", rndm, "] REASON: ", evt, " <\n");
		});

        this.webSocket.addEventListener("error", ( err ) => { 
			//debug
			var rndm = Math.floor( Math.random() * 1000 );
			console.log("!- CLIENT WEBSOCKET ERRORED: [", rndm,"] -!\n");
			console.log("> [", rndm, "] ERROR: ", err, " <\n");
		});

        this.webSocket.addEventListener("message", async ({ data }) => {
			//debug
			var rndm = Math.floor( Math.random() * 1000 );
			console.log("!- CLIENT RECEIVED A MESSAGE [", rndm, "] -!\n");

            let bytes: Uint8Array;

            if( data instanceof Blob ) data = await data.arrayBuffer();
            
            if( data instanceof ArrayBuffer ) bytes = new Uint8Array( data );
            else if( data instanceof Uint8Array ) bytes = data;
            else throw new Error("Invalid data type");

			const msg = parseMutexoMessage( bytes );

			//debug
			console.log("> MESSAGE: [", rndm, "]: ", msg, " <\n");

			const name = msgToName( msg );
			if( typeof name !== "string" ) throw new Error("Invalid message");

			this.dispatchEvent( name, msg as any );
        });
    }

    async sub(
        eventName: MutexoClientEvtName,
        filters: Filter[] = []
    ): Promise<MessageSubSuccess | MessageSubFailure>
    {
        const id = getUniqueId();

		console.log("!- WAITING FOR THE WS TO BE READY [", id, "] -!\n");

        await this.waitWsReady();

		console.log("> OK, CLIENT READY! [", id, "] <\n");
		console.log("!- CLIENT SUBBING FOR EVENT: ", eventName, " [", id, "] -!\n");

		const self = this;

		return new Promise<MessageSubSuccess | MessageSubFailure>((resolve, reject) => {
            function handleSuccess( msg: MessageSubSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("subSuccess", () => ( handleSuccess ));
                self.off("subFailure", () => ( handleFailure ));

				console.log("> [", id, "] SUBSCRIPTION SUCCESS: ", msg, " <\n");

                resolve( msg );
            }
            function handleFailure( msg: MessageSubFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("subSuccess", () => ( handleSuccess ));
                self.off("subFailure", () => ( handleFailure ));

				console.log("> [", id, "] SUBSCRIPTION FAILURE: ", msg, " <\n");

                resolve( msg );
            }

			self.on("subSuccess", () => ( handleSuccess ));
			self.on("subFailure", () => ( handleFailure ));

			console.log("!- SENDING SUB MESSAGE [", id, "] -!\n");

			this.webSocket.send(
				new ClientSub({
					id,
					eventType: eventNameToMutexoEventIndex( eventName ),
					filters
				}).toCbor().toBuffer()
			);
        });
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
    ): Promise<MessageMutexSuccess | MessageMutexFailure>
    {
        await this.waitWsReady();

        if(!(
            Number.isSafeInteger( required ) &&
            required > 0
        )) required = 1;

        const self = this;

        const id = getUniqueId();

        return new Promise<MessageMutexSuccess | MessageMutexFailure>((resolve, reject) => {
            function handleSuccess( msg: MessageMutexSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mtxSuccess", handleSuccess);
                self.off("mtxFailure", handleFailure);
                resolve( msg );
            }
            function handleFailure( msg: MessageMutexFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mtxSuccess", handleSuccess);
                self.off("mtxFailure", handleFailure);
                resolve( msg );
            }

            self.on("mtxSuccess", handleSuccess);
            self.on("mtxFailure", handleFailure);
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
    ): Promise<MessageMutexSuccess | MessageMutexFailure>
    {
        await this.waitWsReady();

        const self = this;

        const id = getUniqueId();

        return new Promise<MessageMutexSuccess | MessageMutexFailure>((resolve, reject) => {
            function handleSuccess( msg: MessageMutexSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off( "mtxSuccess", handleSuccess );
                self.off( "mtxFailure", handleFailure );
                resolve( msg );
            }
            function handleFailure( msg: MessageMutexFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off( "mtxSuccess", handleSuccess );
                self.off( "mtxFailure", handleFailure );
                resolve( msg );
            }

            self.on( "mtxSuccess", handleSuccess );
            self.on( "mtxFailure", handleFailure );
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
                free: 		[],
                lock: 		[],
                input: 		[],
                output: 	[],
                mtxSuccess: [],
                mtxFailure: [],
                error: 		[],
                subSuccess: [],
                subFailure: []
            };
        }

        return this;
    }

}