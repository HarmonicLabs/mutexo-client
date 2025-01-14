import { Close, MutexoFree, MutexFailure, MutexoError, MutexoInput, MutexoMessage, MutexoOutput, MutexSuccess, SubFailure, SubSuccess, MutexoLock } from "@harmoniclabs/mutexo-messages";
import { MutexoClientEvtName } from "../MutexoClient";

export function msgToName( msg: MutexoMessage ): MutexoClientEvtName | undefined
{
    if( msg instanceof MutexoFree )         return "free";
    if( msg instanceof MutexoLock )         return "lock";
    if( msg instanceof MutexoInput )        return "input";
    if( msg instanceof MutexoOutput )       return "output";
    if( msg instanceof MutexSuccess )       return "mutexSuccess";
    if( msg instanceof MutexFailure )       return "mutexFailure";
    if( msg instanceof Close )              return "close";
    if( msg instanceof MutexoError )        return "error";
    if( msg instanceof SubSuccess )         return "subSuccess";
    if( msg instanceof SubFailure )         return "subFailure";

    return undefined;
}

export function eventNameToMutexoEventIndex( eventName: MutexoClientEvtName ): number
{
    switch( eventName )
    {
        case "free": return 0;
        case "lock": return 1;
        case "input": return 2;
        case "output": return 3;
        case "mutexSuccess": return 4;
        case "mutexFailure": return 5;
        case "close": return 6;
        case "error": return 7;
        case "subSuccess": return 8;
        case "subFailure": return 9;
    }

    throw new Error("Unknown event name");
}

export function msgToEvtIdx( msg: MutexoMessage ): number
{
    if( msg instanceof MutexoFree )         return 0;
    if( msg instanceof MutexoLock )         return 1;
    if( msg instanceof MutexoInput )        return 2;
    if( msg instanceof MutexoOutput )       return 3;
    if( msg instanceof MutexSuccess )       return 4;
    if( msg instanceof MutexFailure )       return 5;
    if( msg instanceof Close )              return 6;
    if( msg instanceof MutexoError )        return 7;
    if( msg instanceof SubSuccess )         return 8;
    if( msg instanceof SubFailure )         return 9;

    throw new Error("Unknown mtuexo message");
}