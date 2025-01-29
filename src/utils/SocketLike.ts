import { isObject } from "@harmoniclabs/obj-utils";
import type { AddressInfo } from "net";

// can not get all overload of BufferConstructor['from'], need to copy all it's first arguments here
// https://github.com/microsoft/TypeScript/issues/32164
type BufferLike =
    | Blob
    | string
    | Buffer
    | DataView
    | number
    | ArrayBufferView
    | Uint8Array
    | ArrayBuffer
    | SharedArrayBuffer
    | readonly any[]
    | readonly number[]
    | { valueOf(): ArrayBuffer }
    | { valueOf(): SharedArrayBuffer }
    | { valueOf(): Uint8Array }
    | { valueOf(): readonly number[] }
    | { valueOf(): string }
    | { [Symbol.toPrimitive](hint: string): string };

type RawData = Buffer | ArrayBuffer | Buffer[];


export interface NodeWebSocketLike {

    binaryType: "nodebuffer" | "arraybuffer" | "fragments";

    /** The current state of the connection */
    readonly readyState: 0 | 1 | 2 | 3;

    close(code?: number, data?: string | Buffer): void;
    ping(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    pong(data?: any, mask?: boolean, cb?: (err: Error) => void): void;
    // https://github.com/websockets/ws/issues/2076#issuecomment-1250354722
    send(data: BufferLike, cb?: (err?: Error) => void): void;
    send(
        data: BufferLike,
        options: {
            mask?: boolean | undefined;
            binary?: boolean | undefined;
            compress?: boolean | undefined;
            fin?: boolean | undefined;
        },
        cb?: (err?: Error) => void,
    ): void;
    /**
     * subscribe to an event
    **/
    // Events
    on(event: "close", listener: (this: NodeWebSocketLike, code: number, reason: Buffer) => void): this;
    on(event: "error", listener: (this: NodeWebSocketLike, err: Error) => void): this;
    on(event: "upgrade", listener: (this: NodeWebSocketLike, request: any) => void): this;
    on(event: "message", listener: (this: NodeWebSocketLike, data: RawData, isBinary: boolean) => void): this;
    on(event: "open", listener: (this: NodeWebSocketLike) => void): this;
    on(event: "ping" | "pong", listener: (this: NodeWebSocketLike, data: Buffer) => void): this;
    on(
        event: "unexpected-response",
        listener: (this: NodeWebSocketLike, request: any, response: any) => void,
    ): this;
    on(event: string | symbol, listener: (this: NodeWebSocketLike, ...args: any[]) => void): this;
    // on(event: "drain", listener: () => void): this;
    // on(event: "end", listener: () => void): this;
    // on(event: "lookup", listener: (err: Error, address: string, family: string | number, host: string) => void): this;
    // on(event: "ready", listener: () => void): this;
    // on(event: "timeout", listener: () => void): this;
    /**
     * unsubscribe to an event
    **/
    removeListener(event: "close", listener: (code: number, reason: Buffer) => void): this;
    removeListener(event: "error", listener: (err: Error) => void): this;
    removeListener(event: "upgrade", listener: (request: any) => void): this;
    removeListener(event: "message", listener: (data: RawData, isBinary: boolean) => void): this;
    removeListener(event: "open", listener: () => void): this;
    removeListener(event: "ping" | "pong", listener: (data: Buffer) => void): this;
    removeListener(
        event: "unexpected-response",
        listener: (request: any, response: any) => void,
    ): this;
    removeListener(event: string | symbol, listener: (...args: any[]) => void): this;
}


export function isNodeWebSocketLike( s: any ): s is NodeWebSocketLike
{
    return isObject( s ) && (
        typeof s.on             === "function" &&
        typeof s.removeListener === "function" &&
        typeof s.send           === "function" &&
        typeof s.close          === "function" &&
        typeof s.ping           === "function" &&
        typeof s.pong           === "function"
    );
}

export type NodeWebSocketLikeEvt
    = "close"
    | "connect"
    | "data"
    | "drain"
    | "end"
    | "error"
    | "lookup"
    | "ready"
    | "timeout";

export interface WebSocketLike {
    /**
     * Transmits data using the WebSocket connection. data can be a string, a Blob, an ArrayBuffer, or an ArrayBufferView.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/send)
    **/
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    /**
     * Closes the WebSocket connection, optionally using code as the the WebSocket connection close code and reason as the the WebSocket connection close reason.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/close)
     */
    close(code?: number, reason?: string): void;
    /**
     * Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.
     *
     * The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.
     *
     * When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.
     *
     * When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.
     *
     * When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.
     *
     * If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.
     *
     * The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)
     */
    addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    /**
     * Removes the event listener in target's event listener list with the same type, callback, and options.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)
     */
    removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
    /**
     * [MDN docs](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState)
     * 
     * @returns
     * One of the following unsigned short values:
     *
     * Value |	State     |	Description
     * ------|------------|-----------
     * 0	 | CONNECTING |	Socket has been created. The connection is not yet open.
     * 1	 | OPEN	      |  The connection is open and ready to communicate.
     * 2	 | CLOSING	  |  The connection is in the process of closing.
     * 3	 | CLOSED	  |  The connection is closed or couldn't be opened.
    **/
    readonly readyState: 0 | 1 | 2 | 3;
}

export function isWebSocketLike( s: any ): s is WebSocketLike
{
    return isObject( s ) && !isNodeWebSocketLike( s ) && (
        typeof s.send                   === "function" &&
        typeof s.close                  === "function" &&
        typeof s.addEventListener       === "function" &&
        typeof s.removeEventListener    === "function"
    );
}

export type WebSocketLikeEvt
    = "close"   // node equivalent of "close" or "end"
    | "error"   // node equivalent of "error"
    | "message" // node equivalent of "data"
    | "open";   // node equivalent of "connect" or "ready"

export type SocketLike = NodeWebSocketLike | WebSocketLike;

/**
 * any `SocketLike` but with a common interface
**/
export interface WrappedSocket {
    send: ( data: Uint8Array ) => void
    /**
     * close the comunication
     */
    close: () => void
    /**
     * subscribe to an event
    **/
    on(event: "close", listener: ( hadError: boolean ) => void): void;
    on(event: "error", listener: ( thing: Error | Event ) => void ): void;
    on(event: "data", listener: ( data: RawData ) => void): void;
    on(event: "connect", listener: () => void): void;
    /**
     * unsubscribe to an event
    **/
    off(event: "close", listener: ( hadError: boolean ) => void): void;
    off(event: "error", listener: ( thing: Error | Event ) => void ): void;
    off(event: "data", listener: ( data: Uint8Array ) => void): void;
    off(event: "connect", listener: () => void): void;
    
    isClosed: () => boolean;
    isReady: () => boolean;

    unwrap: <S extends SocketLike>() => S;
}

export type WrappedSocketEvt
    = "close"
    | "error"
    | "data"
    | "connect";

function webSocketLikeIsClosed( this: WebSocketLike ): boolean
{
    return this.readyState >= 2;
}
function webSocketLikeIsReady( this: WebSocketLike ): boolean
{
    return this.readyState === 1;
}

function nodeWebSocketLikeIsClosed( this: NodeWebSocketLike ): boolean
{
    return this.readyState >= 2;
}

function nodeWebSocketLikeIsReady( this: NodeWebSocketLike ): boolean
{
    return this.readyState === 1;
}

export function wrapSocket(
    socketLike: SocketLike
): WrappedSocket
{
    const _evts: { [key: string]: any } = {};
    if( isNodeWebSocketLike( socketLike ) )
    {
        socketLike.binaryType = "arraybuffer";

        const pingHandler = () => socketLike.pong();
        socketLike.on("ping", pingHandler);
        if( globalThis.process && typeof globalThis.process.on === "function" )
        {
            const removeHandler = () => {
                try {
                    socketLike?.removeListener("ping", pingHandler);
                } catch {}
            }
            try {
                process.on("beforeExit", removeHandler );
                process.on("exit", removeHandler );
                process.on('SIGTERM', removeHandler );
                process.on('SIGINT', removeHandler );
            }
            catch {}
        }

        const socket: WrappedSocket = {
            unwrap: () => socketLike as any,
            isClosed: nodeWebSocketLikeIsClosed.bind( socketLike ),
            isReady: nodeWebSocketLikeIsReady.bind( socketLike ),
            send: socketLike.send.bind( socketLike ),
            close: socketLike.close.bind( socketLike ),
            on( evtName, listener ) {
                switch( evtName )
                {
                    case "close":
                        socketLike.on("close", listener);
                        break;
                    case "error":
                        socketLike.on("error", listener);
                        break;
                    case "connect":
                        socketLike.on("open", listener);
                        break;
                    case "data":
                        socketLike.on("message", listener);
                        break;
                    default:
                        // unknown event type; ignore
                        break;
                }
            },
            off( evtName, listener ) {
                switch( evtName )
                {
                    case "close":
                        socketLike.removeListener("close", listener);
                        break;
                    case "error":
                        socketLike.removeListener("error", listener);
                        break;
                    case "connect":
                        socketLike.removeListener("open", listener);
                        break;
                    case "data":
                        socketLike.removeListener("message", listener);
                        break;
                    default:
                        // unknown event type; ignore
                        break;
                }
            },
        };

        return Object.freeze( socket );
    }
    else if( isWebSocketLike( socketLike ) )
    {
        const socket: WrappedSocket = {
            unwrap: () => socketLike as any,
            isClosed: webSocketLikeIsClosed.bind( socketLike ),
            isReady: webSocketLikeIsReady.bind( socketLike ),
            send: socketLike.send.bind( socketLike ),
            close: socketLike.close.bind( socketLike ),
            on( evt: WrappedSocketEvt, listener: (thing: any) => void ): void
            {
                if( evt === "close" )
                {
                    socketLike.addEventListener(
                        "close",
                        listener
                    );
                }
                else if( evt === "error" )
                {
                    socketLike.addEventListener(
                        "error",
                        listener
                    );
                }
                else if( evt === "connect" )
                {
                    socketLike.addEventListener(
                        "open",
                        listener
                    );
                }
                else if( evt === "data" )
                {
                    socketLike.addEventListener(
                        "message",
                        evt => listener( new Uint8Array( evt.data ) )
                    );
                }
                else {
                    // unknown event type; ignore
                }
            },
            off( evt: WrappedSocketEvt, listener: ( thing: any ) => void ): void
            {
                if( evt === "close" )
                {
                    socketLike.removeEventListener(
                        "close",
                        listener
                    );
                }
                else if( evt === "error" )
                {
                    socketLike.removeEventListener(
                        "error",
                        listener
                    );
                }
                else if( evt === "connect" )
                {
                    socketLike.removeEventListener(
                        "open",
                        listener
                    );
                }
                else if( evt === "data" )
                {
                    socketLike.removeEventListener(
                        "message",
                        evt => listener( new Uint8Array( evt.data ) )
                    );
                }
                else {
                    // unknown event type; ignore
                }
            }
        };

        return Object.freeze( socket );
    }
    
    throw new Error("cannot wrap " + socketLike + " as a socket because it doesn't meet the 'SocketLike' interface");
}