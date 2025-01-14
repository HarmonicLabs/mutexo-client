import { ClientReqFree, ClientReqLock, ClientSub, ClientUnsub, Filter, MutexoError, MutexFailure, MutexoFree, MutexoInput, MutexoLock, MutexoOutput, MutexSuccess, MutexoMessage, SubFailure, SubSuccess, Close } from "@harmoniclabs/mutexo-messages";
import { parseMutexoMessage } from "@harmoniclabs/mutexo-messages/dist/utils/parsers";
import { CanBeTxOutRef, forceTxOutRef } from "@harmoniclabs/cardano-ledger-ts";
import { eventNameToMutexoEventIndex, msgToName } from "./utils/mutexEvents";
import { getUniqueId, releaseUniqueId } from "./utils/ids";

export type MutexoClientEvtName = keyof MutexoClientEvtListeners;

type MutexoClientEvtListeners = {
    free:           MutexoClientEvtListener[],
    lock:           MutexoClientEvtListener[],
    input:          MutexoClientEvtListener[],
    output:         MutexoClientEvtListener[],
    mutexSuccess:   MutexoClientEvtListener[],
    mutexFailure:   MutexoClientEvtListener[],
    close:          MutexoClientEvtListener[],
    error:          MutexoClientEvtListener[],
    subSuccess:     MutexoClientEvtListener[],
    subFailure:     MutexoClientEvtListener[]
};

type MutexoClientEvtListener = ( msg: MutexoMessage ) => void;

type DataOf<EvtName extends MutexoClientEvtName> =
    EvtName extends "free"          ? MutexoFree    :
    EvtName extends "lock"          ? MutexoLock   :
    EvtName extends "input"         ? MutexoInput   :
    EvtName extends "output"        ? MutexoOutput  :
    EvtName extends "mutexSuccess"  ? MutexSuccess  :
    EvtName extends "mutexFailure"  ? MutexFailure  :
    EvtName extends "close"         ? Close 	    :
    EvtName extends "error"         ? MutexoError   :
    EvtName extends "subSuccess"    ? SubSuccess    :
    EvtName extends "subFailure"    ? SubFailure    :
    never;

function isMutexoClientEvtName( stuff: any ): stuff is MutexoClientEvtName
{
    return (
        stuff === "free"            ||
        stuff === "lock"            ||
        stuff === "input"           ||
        stuff === "output"          ||
        stuff === "mutexSuccess"    ||
        stuff === "mutexFailure"    ||
        stuff === "close"    ||
        stuff === "error"           ||
        stuff === "subSuccess"      ||
        stuff === "subFailure"
    );
}
 
export class MutexoClient
{
    private readonly webSocket: WebSocket;

    private readonly _eventListeners: Record<MutexoClientEvtName, MutexoClientEvtListener[]> = Object.freeze({
        free: 		    [],
        lock: 		    [],
        input: 		    [],
        output: 	    [],
        mutexSuccess:   [],
        mutexFailure:   [],
        close: 		    [],
        error: 		    [],
        subSuccess:     [],
        subFailure:     []
    });
    private readonly _onceEventListeners: Record<MutexoClientEvtName, MutexoClientEvtListener[]> = Object.freeze({
        free: 		    [],
        lock: 		    [],
        input: 		    [],
        output: 	    [],
        mutexSuccess:   [],
        mutexFailure:   [],
        close: 		    [],
        error: 		    [],
        subSuccess:     [],
        subFailure:     []
    });

    private _destroyed: boolean = false;

    private _wsReady: boolean;
    async waitWsReady(): Promise<void>
    {
        if( this._destroyed ) throw new Error("Client was closed");
        if( this._wsReady ) return;

        return new Promise(( resolve ) => {
            this.webSocket.addEventListener("open", () => {
				this._wsReady = true;
				resolve();
			}, 
			{ once: true });
        });
    }

    /**
     * gets an authentication token from the server
     * 
     * the token is valid for 30 seconds
     */
    static async fetchAuthToken( httpUrl: string | URL ): Promise<string>
    {
        if( typeof httpUrl === "string" ) httpUrl = new URL( httpUrl );

        httpUrl.pathname = "/wsAuth";
        httpUrl.protocol = httpUrl.protocol === "https:" ? "https:" : "http:";

        const res = await fetch( httpUrl.toString() );
        if( !res.ok ) throw new Error("Failed to fetch auth token");

        return await res.text();
    }

    /**
     * returns a valid url to be used for the websocket connectionl
     * 
     * the url is valid for 30 seconds
     * 
     * @example
     * ```ts
     * const mutexo = new MutexoClient(
     *     new WebSocket(
     *         await MutexoClient.getWsUrl( "http://my-mutexo-sever.io:3001" )
     *     )
     * );
     * ```
     */
    static async getWsUrl( httpUrl: string ): Promise<string>
    {
        const url = new URL( httpUrl );

        const isSecureConnection = url.protocol === "https:";
        url.protocol = !isSecureConnection ? "http:" : "https:";
        url.pathname = "";
        url.search = "";

        const token = await MutexoClient.fetchAuthToken( url.toString() );

        url.protocol = isSecureConnection ? "wss:" : "ws:";
        url.pathname = "/wsAuth";
        url.searchParams.set("token", token);

        return url.toString();
    }

    constructor( webSocket: WebSocket )
    {
        this.webSocket = webSocket;
        this.webSocket.binaryType = "arraybuffer";
        this._wsReady = this.webSocket.readyState === WebSocket.OPEN;

        this.waitWsReady();

        this.webSocket.addEventListener("close", this._destroy );
        this.webSocket.addEventListener("error", this._destroy );

        this.webSocket.addEventListener("message", async ({ data }) => {
            let bytes: Uint8Array;

            if( data instanceof Blob ) data = await data.arrayBuffer();
            
            if( data instanceof ArrayBuffer ) bytes = new Uint8Array( data );
            else if( data instanceof Uint8Array ) bytes = data;
            else throw new Error("Invalid data type");

			const msg = parseMutexoMessage( bytes );

			const name = msgToName( msg );

			if( typeof name !== "string" ) throw new Error("Invalid message");

			this.dispatchEvent( name, msg as any );
        });

        const self = this;

        process.on("beforeExit", () => { self?._destroy(); });
        process.on("exit", () => { self?._destroy(); })
    }

    async sub<EvtName extends MutexoClientEvtName>(
        eventName: MutexoClientEvtName,
        filters: Filter[] = [],
        evtHandler?: ( msg: DataOf<EvtName> ) => void,
    ): Promise<SubSuccess | SubFailure>
    {
        const id = getUniqueId();
        await this.waitWsReady();

        const hasEvtHandler = typeof evtHandler === "function";

		const self = this;

		return new Promise<SubSuccess | SubFailure>((resolve, reject) => {
            function handleSuccess( msg: SubSuccess )
            {
				if( msg.id !== id ) return;
                releaseUniqueId( id );

                if( hasEvtHandler ) self.addEventListener(eventName, evtHandler);

                self.off("subSuccess", handleSuccess);
                self.off("subFailure", handleFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleFailure( msg: SubFailure )
            {                				
				if( msg.id !== id ) return;

                // if( hasEvtHandler ) self.removeEventListener(eventName, evtHandler);

                releaseUniqueId( id );
                self.off("subSuccess", handleSuccess);
                self.off("subFailure", handleFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleError( msg: MutexoError )
            {
                releaseUniqueId( id );

                // if( hasEvtHandler ) self.removeEventListener(eventName, evtHandler);

                self.off("subSuccess", handleSuccess);
                self.off("subFailure", handleFailure);
                self.off("error", handleError);

                reject( new Error( msg.message ) );
            }

			self.on("subSuccess", handleSuccess);
			self.on("subFailure", handleFailure);
            self.on("error", handleError);

            // if( hasEvtHandler ) self.addEventListener(eventName, evtHandler);

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
    ): Promise<SubSuccess | SubFailure>
    {
        const id = getUniqueId();
        await this.waitWsReady();

		const self = this;

		return new Promise<SubSuccess | SubFailure>((resolve, reject) => {
            function handleSuccess( msg: SubSuccess )
            {
				if( msg.id !== id ) return;
                releaseUniqueId( id );

                self.off("subSuccess", handleSuccess);
                self.off("subFailure", handleFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleFailure( msg: SubFailure )
            {                				
				if( msg.id !== id ) return;
                releaseUniqueId( id );

                self.off("subSuccess", handleSuccess);
                self.off("subFailure", handleFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleError( msg: MutexoError )
            {
                releaseUniqueId( id );

                self.off("subSuccess", handleSuccess);
                self.off("subFailure", handleFailure);
                self.off("error", handleError);

                reject( new Error( msg.message ) );
            }

			self.on("subSuccess", handleSuccess);
			self.on("subFailure", handleFailure);
            self.on("error", handleError);

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
    ): Promise<MutexSuccess | MutexFailure>
    {
        const id = getUniqueId();
        await this.waitWsReady();

        if(!(
            Number.isSafeInteger( required ) &&
            required > 0
        )) required = 1;

        const self = this;

        return new Promise<MutexSuccess | MutexFailure>((resolve, reject) => {
            function handleSuccess( msg: MutexSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );

                self.off("mutexSuccess", handleSuccess);
                self.off("mutexFailure", handleFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleFailure( msg: MutexFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );
                self.off("mutexSuccess", handleSuccess);
                self.off("mutexFailure", handleFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleError( msg: MutexoError )
            {
                releaseUniqueId( id );
                self.off("mutexSuccess", handleSuccess);
                self.off("mutexFailure", handleFailure);
                self.off("error", handleError);

                reject( new Error( msg.message ) );
            }

            self.on("mutexSuccess", handleSuccess);
			self.on("mutexFailure", handleFailure);
            self.on("error", handleError);

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
    ): Promise<MutexSuccess | MutexFailure>
    {
        const id = getUniqueId();
        await this.waitWsReady();

        const self = this;

        return new Promise<MutexSuccess | MutexFailure>((resolve, reject) => {
            function handleMtxSuccess( msg: MutexSuccess )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );

                self.off("mutexSuccess", handleMtxSuccess);
                self.off("mutexFailure", handleMtxFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleMtxFailure( msg: MutexFailure )
            {
                if( msg.id !== id ) return;
                releaseUniqueId( id );

                self.off("mutexSuccess", handleMtxSuccess);
                self.off("mutexFailure", handleMtxFailure);
                self.off("error", handleError);

                resolve( msg );
            }
            function handleError( msg: MutexoError )
            {
                releaseUniqueId( id );

                self.off("mutexSuccess", handleMtxSuccess);
                self.off("mutexFailure", handleMtxFailure);
                self.off("error", handleError);

                reject( new Error( msg.message ) );
            }

            self.on("mutexSuccess", handleMtxSuccess);
			self.on("mutexFailure", handleMtxFailure);
            self.on("error", handleError);

            self.webSocket.send(
                new ClientReqFree({
                    id,
                    utxoRefs: utxoRefs.map( forceTxOutRef )
                }).toCbor().toBuffer()
            );
        });
    }

    private _destroy()
    {
        if( !this ) return;
        this.dispatchEvent("close", new Close());
        this._destroyed = true;
        this._wsReady = false;
    }

    close()
    {
        this.webSocket.send( new Close().toCbor().toBuffer() );
        this.webSocket.close();
        this._destroy();
    }

    addEventListener<Evt extends MutexoClientEvtName>( evt: Evt, callback: ( data: DataOf<Evt> ) => void, opts?: AddEventListenerOptions ): this
    {
        return this.on( evt, callback, opts );
    }
    addListener<Evt extends MutexoClientEvtName>( evt: Evt, callback: ( data: DataOf<Evt> ) => void, opts?: AddEventListenerOptions ): this
    {
        return this.on( evt, callback, opts );
    }
    on<Evt extends MutexoClientEvtName>( evt: Evt, callback: ( data: DataOf<Evt> ) => void, opts?: AddEventListenerOptions ): this
    {
        if( opts?.once ) return this.addEventListenerOnce( evt, callback );
        
        const listeners = this._eventListeners[ evt ];
        if( !listeners ) return this;

        listeners.push( callback );
        
        return this;
    }

    addEventListenerOnce( evt: MutexoClientEvtName, callback: ( data: any ) => void ): this
    {
        return this.once( evt, callback );
    }
    once( evt: MutexoClientEvtName, callback: ( data: any ) => void ): this
    {
        const listeners = this._onceEventListeners[ evt ];
        if( !listeners ) return this;

        listeners.push( callback );
        
        return this;
    }

    removeEventListener( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {
        return this.off( evt, callback );
    }
    removeListener( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {
        return this.off( evt, callback );
    }
    off( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {
        let listeners = this._eventListeners[ evt ];
        if( Array.isArray( listeners ) ) 
        {
            const idx = listeners.findIndex(( cb ) => callback === cb );
            
            if( idx >= 0 ) void listeners.splice( idx, 1 );
        }

        listeners = this._onceEventListeners[ evt ];
        if( !listeners ) return this;
        
        if( !Array.isArray( listeners ) ) return this;

        const idx = listeners.findIndex(( cb ) => callback === cb );
        
        if( idx >= 0 ) void listeners.splice( idx, 1 );

        return this;
    }

    emit<EvtName extends MutexoClientEvtName>( evt: EvtName, msg: DataOf<EvtName> ): boolean
    {
        return this.dispatchEvent( evt, msg );
    }
    dispatchEvent<EvtName extends MutexoClientEvtName>( evt: EvtName, msg: DataOf<EvtName> ): boolean
    {
		let listeners = this._eventListeners[ evt ];
        if( !listeners ) return false;

        for( const listener of listeners ) listener( msg );

        listeners = this._onceEventListeners[ evt ];

        let cb: MutexoClientEvtListener;
        while( cb = listeners.shift()! ) cb( msg );

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
            this._eventListeners[ event ].length = 0;
            this._onceEventListeners[ event ].length = 0
        }
        else
        {
            _clearAllListeners( this._eventListeners );
            _clearAllListeners( this._onceEventListeners );
        }

        return this;
    }
}

function _clearAllListeners( listeners: MutexoClientEvtListeners )
{
    listeners.free.length = 0;
    listeners.lock.length = 0;
    listeners.input.length = 0;
    listeners.output.length = 0;
    listeners.mutexSuccess.length = 0;
    listeners.mutexFailure.length = 0;
    listeners.close.length = 0;
    listeners.error.length = 0;
    listeners.subSuccess.length = 0;
    listeners.subFailure.length = 0;
}