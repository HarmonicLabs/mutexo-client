
export function eventNameToMutexoEventIndex( evtName: string ): number
{
  switch ( evtName ) {
    default: throw new Error( `Unknown event name: ${evtName}` );
  }
}