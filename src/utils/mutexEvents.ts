import { MessageError, MessageFailure, MessageFree, MessageInput, MessageLock, MessageOutput, MessageSuccess, MutexoMessage } from "@harmoniclabs/mutexo-messages";
import { MutexoEventIndex } from "@harmoniclabs/mutexo-messages/dist/utils/constants";
import { MutexoClientEvtName } from "../MutexoClient";

export function eventNameToMutexoEventIndex( evtName: string ): number
{
    const evtIndex = MutexoEventIndex[ capitalizeFirstLetter( evtName ) as keyof typeof MutexoEventIndex ];

    if( evtIndex !== undefined ) return evtIndex
    else throw new Error( "Unknown event name: " + evtName );
}
function capitalizeFirstLetter( str: string ): string {
    if( str.length === 0 ) throw new Error( "Invalid event string" );
    return str.charAt( 0 ).toUpperCase() + str.slice( 1 );
}

export function msgToName( msg: MutexoMessage ): MutexoClientEvtName | undefined
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
