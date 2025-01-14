const PENDING_IDS: Set<number> = new Set();

export function getUniqueId(): number
{
    let id: number;
    while(
        PENDING_IDS.has(
            id = ( Math.random() * 0xff_ff_ff_ff ) >>> 0 // shift rounds to 32-bit unsigned integer (otherwhise is float)
        )
    ) {}
    PENDING_IDS.add( id );
    return id;
}

export function releaseUniqueId( id: number )
{
    PENDING_IDS.delete( id );
}