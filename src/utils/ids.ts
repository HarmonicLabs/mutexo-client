const PENDING_IDS: number[] = [];

export function getUniqueId(): number
{
    let id: number;
    while(
        !PENDING_IDS.includes(
            id = Math.floor( Math.random() * Number.MAX_SAFE_INTEGER )
        )
    ) {}
    PENDING_IDS.push( id );
    return id;
}

export function releaseUniqueId( id: number )
{
    const idx = PENDING_IDS.indexOf( id );
    if( idx < 0 ) return;
    void PENDING_IDS.splice( idx, 1 );
}
