import { MessageError, MessageFailure, MessageFree, MessageInput, MessageLock, MessageOutput, MessageSuccess, MutexoMessage, mutexoMessageFromCborObj } from "@harmoniclabs/mutexo-messages";
import { isObject } from "@harmoniclabs/obj-utils";
import { CborArray } from "@harmoniclabs/cbor";

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

type MutexoClientEvtName = keyof MutexoClientEvtListeners;

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

    private eventListeners: { [key: string]: MutexoClientEvtListener[] } = {};

    clearListeners!:        ( event?: MutexoClientEvtName ) => this;
    removeAllListeners:     ( event?: MutexoClientEvtName ) => this;

    addEventListener:    <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    addListener:         <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    // on:                  <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    // once:                <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    removeEventListener: <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    removeListener:      <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    // off:                 <EvtName extends MutexoClientEvtName>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
    emit:                <EvtName extends MutexoClientEvtName>( evt: EvtName, msg: DataOf<EvtName> ) => boolean
    dispatchEvent:       <EvtName extends MutexoClientEvtName>( evt: EvtName, msg: DataOf<EvtName> ) => boolean

    constructor( webSocket: WebSocket )
    {
        this.webSocket = webSocket;

        this.clearListeners = ( event?: MutexoClientEvtName ) =>
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

        this.addEventListener = ( event: MutexoClientEvtName, listener: MutexoClientEvtListener ) =>
        {
            if( !this.eventListeners[ event ] )
            {
                this.eventListeners[ event ] = [];
            }

            this.eventListeners[ event ].push( listener );

            return this;
        }
        
    }

    sub(): Promise<void>
    {
    }

    unsub(): Promise<void>
    {
    }

    lock(): Promise<void>
    {
    }

    free(): Promise<void>
    {
    }

    on( evt: MutexoClientEvtName, callback: ( data: any ) => void ): this
    {
        // switch( evt )
        // {
        //     case "free":
        //         this.webSocket.addEventListener( "free", callback );
        //         break;
        //     case "lock":
        //         this.webSocket.addEventListener( "lock", callback );
        //         break;
        //     case "input":
        //         this.webSocket.addEventListener( "input", callback );
        //         break;
        //     case "output":
        //         this.webSocket.addEventListener( "output", callback );
        //         break;
        //     case "success":
        //         this.webSocket.addEventListener( "success", callback );
        //         break;
        //     case "failure":
        //         this.webSocket.addEventListener( "failure", callback );
        //         break;
        //     case "error":
        //         this.webSocket.addEventListener( "error", callback );
        //         break;
        //     default:
        //         throw new Error( `Invalid event name: ${evt}` );
        // }
        
        return this;
    }

    off( evt: MutexoClientEvtName, callback: ( data: any ) => void )
    {

    }

    parseMutexoMessage( stuff: any ): MutexoMessage
    {
        if(!( 
            isObject( stuff ) &&
            stuff instanceof CborArray 
        )) throw new Error( "Invalid message" );

        return mutexoMessageFromCborObj( stuff );
    }

}

const client = new MutexoClient( new WebSocket( "ws://localhost:8080" ) );

client.on( "free"       , ( data ) => { console.log( data ) } )
client.on( "lock"       , ( data ) => { console.log( data ) } )
client.on( "input"      , ( data ) => { console.log( data ) } )
client.on( "output"     , ( data ) => { console.log( data ) } )
client.on( "success"    , ( data ) => { console.log( data ) } )
client.on( "failure"    , ( data ) => { console.log( data ) } )
client.on( "error"      , ( data ) => { console.log( data ) } )
