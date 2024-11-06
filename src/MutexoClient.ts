import { ClientReqFree, ClientReqLock, ClientSub, ClientUnsub, Filter, MessageError, MessageMutexFailure, MessageFree, MessageInput, MessageLock, MessageOutput, MessageMutexSuccess, MutexoMessage, MessageClose } from "@harmoniclabs/mutexo-messages";
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
            this.webSocket.addEventListener("open", () => {
				this._wsReady = true;
			}, 
			{ 
				once: true 
			});
        }

        this.webSocket.addEventListener("close", ( evt ) => { 
			//debug
			// var rndm = Math.floor( Math.random() * 1000 );
			// console.log("!- CLIENT WEBSOCKET CLOSING FOR REASON: [", rndm,"] -!\n");
			// console.log("> [", rndm, "] REASON: ", evt, " <\n");
			console.log("!- CLIENT WEBSOCKET CLOSING -!\n");
		});

        this.webSocket.addEventListener("error", ( err ) => { 
			//debug
			// var rndm = Math.floor( Math.random() * 1000 );
			// console.log("!- CLIENT WEBSOCKET ERRORED: [", rndm,"] -!\n");
			// console.log("> [", rndm, "] ERROR: ", err, " <\n");
			console.log("!- CLIENT WEBSOCKET ERRORED -!\n");
		});

        this.webSocket.addEventListener("message", async ({ data }) => {
            let bytes: Uint8Array;

            if( data instanceof Blob ) data = await data.arrayBuffer();
            
            if( data instanceof ArrayBuffer ) bytes = new Uint8Array( data );
            else if( data instanceof Uint8Array ) bytes = data;
            else throw new Error("Invalid data type");

			const msg = parseMutexoMessage( bytes );

			//debug
			console.log("> MESSAGE RECEIVED: ", msg, " <\n");

			const name = msgToName( msg );

			if( typeof name !== "string" ) throw new Error("Invalid message");

			this.dispatchEvent( name, msg as any );
        });

        process.on("beforeExit", () => { this?.close(); });
        process.on("exit", () => { this?.close(); })
    }

    async sub(
        eventName: MutexoClientEvtName,
        filters: Filter[] = []
    ): Promise<MessageSubSuccess | MessageSubFailure | MessageError>
    {
        const id = getUniqueId();
        await this.waitWsReady();

		//debug
		console.log("!- CLIENT SUBBING FOR EVENT: ", eventName, " [", id, "] -!\n");

		const self = this;

		return new Promise<MessageSubSuccess | MessageSubFailure| MessageError>((resolve, reject) => {
            function handleSuccess( msg: MessageSubSuccess )
            {
				if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("subFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleFailure( msg: MessageSubFailure )
            {                				
				if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("subFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleError( msg: MessageError )
            {
                releaseUniqueId( id );
                self.off("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("subFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                reject( new Error( msg.message ) );
            }

			self.on("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
			self.on("subFailure", ( msg ) => ( handleFailure( msg ) ));
            self.on("error", ( msg ) => ( handleError( msg ) ));

			self.webSocket.send(
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
    ): Promise<MessageSubSuccess | MessageSubFailure | MessageError>
    {
        const id = getUniqueId();
        await this.waitWsReady();

		//debug
		console.log("!- CLIENT UNSUBBING FOR EVENT: ", eventName, " [", id, "] -!\n");

		const self = this;

		return new Promise<MessageSubSuccess | MessageSubFailure| MessageError>((resolve, reject) => {
            function handleSuccess( msg: MessageSubSuccess )
            {
				if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("subFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleFailure( msg: MessageSubFailure )
            {                				
				if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("subFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleError( msg: MessageError )
            {
                releaseUniqueId( id );
                self.off("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("subFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                reject( new Error( msg.message ) );
            }

			self.on("subSuccess", ( msg ) => ( handleSuccess( msg ) ));
			self.on("subFailure", ( msg ) => ( handleFailure( msg ) ));
            self.on("error", ( msg ) => ( handleError( msg ) ));

			self.webSocket.send(
				new ClientUnsub({
					id,
					eventType: eventNameToMutexoEventIndex( eventName ),
					filters
				}).toCbor().toBuffer()
			);
        });
    }

    async lock(
        utxoRefs: CanBeTxOutRef[],
        required: number = 1
    ): Promise<MessageMutexSuccess | MessageMutexFailure | MessageError>
    {
        const id = getUniqueId();
        await this.waitWsReady();

        if(!(
            Number.isSafeInteger( required ) &&
            required > 0
        )) required = 1;

		//debug
		console.log("!- CLIENT LOCKING ", required ," UTXOS: [", id, "] -!\n");

        const self = this;

        return new Promise<MessageMutexSuccess | MessageMutexFailure | MessageError>((resolve, reject) => {
            function handleSuccess( msg: MessageMutexSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mtxSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("mtxFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleFailure( msg: MessageMutexFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mtxSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("mtxFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleError( msg: MessageError )
            {
                releaseUniqueId( id );
                self.off("mtxSuccess", ( msg ) => ( handleSuccess( msg ) ));
                self.off("mtxFailure", ( msg ) => ( handleFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                reject( new Error( msg.message ) );
            }

            self.on("mtxSuccess", ( msg ) => ( handleSuccess( msg ) ));
			self.on("mtxFailure", ( msg ) => ( handleFailure( msg ) ));
            self.on("error", ( msg ) => ( handleError( msg ) ));

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
    ): Promise<MessageMutexSuccess | MessageMutexFailure | MessageError>
    {
        const id = getUniqueId();
        await this.waitWsReady();

		//debug
		console.log("!- CLIENT FREEING UTXOS: [", id, "] -!\n");

        const self = this;

        return new Promise<MessageMutexSuccess | MessageMutexFailure | MessageError>((resolve, reject) => {
            function handleMtxSuccess( msg: MessageMutexSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mtxSuccess", ( msg ) => ( handleMtxSuccess( msg ) ));
                self.off("mtxFailure", ( msg ) => ( handleMtxFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleMtxFailure( msg: MessageMutexFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mtxSuccess", ( msg ) => ( handleMtxSuccess( msg ) ));
                self.off("mtxFailure", ( msg ) => ( handleMtxFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                resolve( msg );
            }
            function handleError( msg: MessageError )
            {
                releaseUniqueId( id );
                self.off("mtxSuccess", ( msg ) => ( handleMtxSuccess( msg ) ));
                self.off("mtxFailure", ( msg ) => ( handleMtxFailure( msg ) ));
                self.off("error", ( msg ) => ( handleError( msg ) ));

                reject( new Error( msg.message ) );
            }

            self.on("mtxSuccess", ( msg ) => ( handleMtxSuccess( msg ) ));
			self.on("mtxFailure", ( msg ) => ( handleMtxFailure( msg ) ));
            self.on("error", ( msg ) => ( handleError( msg ) ));

            self.webSocket.send(
                new ClientReqFree({
                    id,
                    utxoRefs: utxoRefs.map( forceTxOutRef )
                }).toCbor().toBuffer()
            );
        });
    }

    close()
    {
        this.webSocket.send( new MessageClose().toCbor().toBuffer() );
        this.webSocket.close();
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