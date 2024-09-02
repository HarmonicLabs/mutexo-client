import { MessageFree, MutexoMessage } from "@harmoniclabs/mutexo-messages";

type EvtListener = ( data: MutexoMessage ) => void;

type EvtListenerOf<Evt extends MutexoEvent> = ( data: DataOfEvent<Evt> ) => void;

type DataOfEvent<Evt extends MutexoEvent> 
    = Evt extends MutexoEvent.Free ? MessageFree 
    : never;

/**
clearListeners!: ( event   ?: ChainSyncClientEvtName ) => this;

addEventListener:    <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName>, options?: AddEvtListenerOpts ) => this
addListener:         <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
on:                  <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this

once:                <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this

removeEventListener: <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
removeListener:      <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this
off:                 <EvtName extends MutexoEvent>( evt: EvtName, listener: EvtListenerOf<EvtName> ) => this

removeAllListeners:  ( event   ?: ChainSyncClientEvtName ) => this

emit:                <EvtName extends ChainSyncClientEvtName>( evt: EvtName, msg: MsgOf<EvtName> ) => boolean
dispatchEvent:       <EvtName extends ChainSyncClientEvtName>( evt: EvtName, msg: MsgOf<EvtName> ) => boolean
 */
 
export class MutexoClient
{
    private readonly ws: WebSocket;

    private evtListeners: { [ evtType: MutexoEvent ]: EvtListener[] } = {};

    constructor( ws: WebSocket )
    {

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

    on( evtType: string, cb: ( data: any ) => void ): this
    {

        return this;
    }

    off( evtType: string, cb: ( data: any ) => void )
    {

    }
}

const client = new MutexoClient( new WebSocket( "ws://localhost:8080" ) );

client
.on("", ( data ) => {})