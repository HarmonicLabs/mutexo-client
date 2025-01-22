import { ClientReqFree, ClientReqLock, ClientSub, ClientUnsub, IFilter, MutexoError, MutexFailure, MutexoFree, MutexoInput, MutexoLock, MutexoOutput, MutexSuccess, MutexoMessage, SubFailure, SubSuccess, Close, forceFilter, mutexoMessageFromCbor, mutexoMessageFromCborObj, mutexoMessageToName, MutexoChainEventName, mutexoEventNameToIndex, isMutexoChainEventName, MutexoChainEventIndex, MutexoEventListeners, DataOf, MutexoEventName, MutexoEventListener, isMutexoEventName } from "@harmoniclabs/mutexo-messages";
import { CanBeTxOutRef, forceTxOutRef } from "@harmoniclabs/cardano-ledger-ts";
import { getUniqueId, releaseUniqueId } from "./utils/clientReqIds";
import { Cbor } from "@harmoniclabs/cbor";

export class MutexoClient
{
    private readonly webSocket: WebSocket;

    private readonly _eventListeners: MutexoEventListeners = Object.freeze({
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
    private readonly _onceEventListeners: MutexoEventListeners = Object.freeze({
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

			const msg = mutexoMessageFromCborObj( Cbor.parse( bytes ) );

			const name = mutexoMessageToName( msg );

			if( typeof name !== "string" ) throw new Error("Invalid message");

			this.dispatchEvent( name, msg as any );
        });

        const self = this;

        process.on("beforeExit", () => { self?._destroy(); });
        process.on("exit", () => { self?._destroy(); })
    }

    async sub<EvtName extends MutexoChainEventName>(
        eventName: EvtName,
        evtHandler?: ( msg: DataOf<EvtName> ) => void
    ): Promise<SubSuccess | SubFailure>
    async sub<EvtName extends MutexoChainEventName>(
        eventName: EvtName,
        filters?: IFilter[],
        evtHandler?: ( msg: DataOf<EvtName> ) => void,
    ): Promise<SubSuccess | SubFailure>
    async sub<EvtName extends MutexoChainEventName>(
        eventName: EvtName,
        filters?: IFilter[] | (( msg: DataOf<EvtName> ) => void),
        evtHandler?: ( msg: DataOf<EvtName> ) => void,
    ): Promise<SubSuccess | SubFailure>
    {
        if( !isMutexoChainEventName( eventName ) )
            throw new Error("Invalid event name, only chain events can be used to subscribe");

        const id = getUniqueId();
        await this.waitWsReady();

        // handle different overloads
        if( typeof evtHandler !== "function" )
        {
            evtHandler = (
                typeof filters === "function" ?
                filters :
                undefined
            );
        }
        filters = Array.isArray( filters ) ? filters.map( forceFilter ) : [];

		const self = this;

		return new Promise<SubSuccess | SubFailure>((resolve, reject) => {
            function handleSuccess( msg: SubSuccess )
            {
				if( msg.id !== id ) return;
                releaseUniqueId( id );

                if( typeof evtHandler === "function" )
                    self.addEventListener(eventName, evtHandler);

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
					chainEventIndex: mutexoEventNameToIndex( eventName ) as MutexoChainEventIndex,
					filters
				}).toCbor().toBuffer()
			);
        });
    }

    async unsub(
        eventName: MutexoChainEventName,
        filters: IFilter[] = []
    ): Promise<SubSuccess | SubFailure>
    {
        if( !isMutexoChainEventName( eventName ) )
            throw new Error("Invalid event name, only chain events can be used");

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
					chainEventIndex: mutexoEventNameToIndex( eventName ) as MutexoChainEventIndex,
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

    addEventListener<Evt extends MutexoEventName>( evt: Evt, callback: ( data: DataOf<Evt> ) => void, opts?: AddEventListenerOptions ): this
    {
        return this.on( evt, callback, opts );
    }
    addListener<Evt extends MutexoEventName>( evt: Evt, callback: ( data: DataOf<Evt> ) => void, opts?: AddEventListenerOptions ): this
    {
        return this.on( evt, callback, opts );
    }
    on<Evt extends MutexoEventName>( evt: Evt, callback: ( data: DataOf<Evt> ) => void, opts?: AddEventListenerOptions ): this
    {
        if( opts?.once ) return this.addEventListenerOnce( evt, callback );
        
        const listeners = this._eventListeners[ evt ];
        if( !listeners ) return this;

        listeners.push( callback );
        
        return this;
    }

    addEventListenerOnce( evt: MutexoEventName, callback: ( data: any ) => void ): this
    {
        return this.once( evt, callback );
    }
    once( evt: MutexoEventName, callback: ( data: any ) => void ): this
    {
        const listeners = this._onceEventListeners[ evt ];
        if( !listeners ) return this;

        listeners.push( callback );
        
        return this;
    }

    removeEventListener( evt: MutexoEventName, callback: ( data: any ) => void )
    {
        return this.off( evt, callback );
    }
    removeListener( evt: MutexoEventName, callback: ( data: any ) => void )
    {
        return this.off( evt, callback );
    }
    off( evt: MutexoEventName, callback: ( data: any ) => void )
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

    emit<EvtName extends MutexoEventName>( evt: EvtName, msg: DataOf<EvtName> ): boolean
    {
        return this.dispatchEvent( evt, msg );
    }
    dispatchEvent<EvtName extends MutexoEventName>( evt: EvtName, msg: DataOf<EvtName> ): boolean
    {
		let listeners = this._eventListeners[ evt ];
        if( !listeners ) return false;

        for( const listener of listeners ) listener( msg );

        listeners = this._onceEventListeners[ evt ];

        let cb: MutexoEventListener;
        while( cb = listeners.shift()! ) cb( msg );

        return true;
    }

    removeAllListeners( event?: MutexoEventName ): this
    {
        return this.clearListeners( event );
    }
    clearListeners( event?: MutexoEventName ): this
    {
        if( isMutexoEventName( event ) )
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

function _clearAllListeners( listeners: MutexoEventListeners )
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