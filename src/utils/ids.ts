const PENDING_IDS: Set<number> = new Set();

export function getUniqueId(): number
{
    let id: number;
    while(
        PENDING_IDS.has(
            id = Math.floor( Math.random() * Number.MAX_SAFE_INTEGER )
        )
    ) {}
    PENDING_IDS.add( id );
    return id;
}

export function releaseUniqueId( id: number )
{
    PENDING_IDS.delete( id );
}