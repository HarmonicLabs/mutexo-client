import { MutexoMessage, mutexoMessageFromCborObj } from "@harmoniclabs/mutexo-messages";
import { MutexoEventIndex } from "@harmoniclabs/mutexo-messages/dist/utils/constants";
import { isObject } from "@harmoniclabs/obj-utils";
import { CborArray } from "@harmoniclabs/cbor";

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

export function parseMutexoMessage( stuff: any ): MutexoMessage
{
    if(!( 
        isObject( stuff ) &&
        stuff instanceof CborArray 
    )) throw new Error( "Invalid message" );

    return mutexoMessageFromCborObj( stuff );
}