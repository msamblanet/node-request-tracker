import extend from "extend";

// https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript
export type ConfigOverrides<T> = {
    [P in keyof T]?: ConfigOverrides<T[P]>;
};

export type RequestTrackerConfig = {
    maxCompleted: number
    maxCompletedMillis: number // milliseconds
    autoCleanup: boolean
}
export type RequestTrackerConfigOverrides = ConfigOverrides<RequestTrackerConfig>

export interface TrackedRequest<X> {
    readonly startTime: number
    readonly completeTime?: number
    readonly desc: string
    readonly meta: X
}

export interface StatusJson<X> {
    startTime: number,
    numTotalRequests: number,
    numPendingRequests: number,
    pending: Array<TrackedRequest<X>>
    completed: Array<TrackedRequest<X>>
}

class RequestEntry<X> implements TrackedRequest<X> {
    next?: RequestEntry<X>
    prev?: RequestEntry<X>

    readonly startTime: number
    completeTime?: number
    readonly desc: string
    readonly meta: X

    constructor(desc: string, meta: X, now: number = new Date().getTime()) {
        this.desc = desc;
        this.meta = meta;
        this.startTime = now ?? new Date().getTime();
    }
}

export class RequestTracker<X> {
    static readonly DEFAULT_CONFIG: RequestTrackerConfig = {
        maxCompleted: 50,
        maxCompletedMillis: 5 * 60 * 1000,
        autoCleanup: true
    }
    static readonly DEFAULT_STATUS_MAPPER = <Y>(entry: RequestEntry<Y>): TrackedRequest<Y> => ({
        startTime: entry.startTime,
        completeTime: entry.completeTime,
        desc: entry.desc,
        meta: entry.meta
    })

    protected readonly config: RequestTrackerConfig;

    public readonly startTime = new Date().getTime()
    protected head: RequestEntry<X> | undefined = undefined
    protected tail: RequestEntry<X> | undefined = undefined
    protected completed: Array<RequestEntry<X>> = []
    protected total = 0
    protected pending = 0

    public get numTotalRequests(): number { return this.total }
    public get numPendingRequests(): number { return this.pending }

    constructor(...options: RequestTrackerConfigOverrides[]) {
        this.config = extend(true, {}, RequestTracker.DEFAULT_CONFIG, ...options ?? []);
    }

    public request(desc: string, meta: X, now = new Date().getTime()): TrackedRequest<X> {
        // Create a request
        const req = new RequestEntry<X>(desc, meta, now);

        // Link the request into the linked list
        req.prev = this.tail;
        this.tail = req;
        if (req.prev) req.prev.next = req;
        else this.head = req;

        // Note it as pending...
        this.pending++;
        this.total++;

        // Return the completion function...
        return req;
    }

    public async track<Y>(desc: string, meta: X, action: (meta: X) => Promise<Y>): Promise<Y> {
        const req = this.request(desc, meta);
        try {
            return await action(meta);
        } finally {
            this.completeRequest(req);
        }
    }

    public completeRequest(_req: TrackedRequest<X>, now = new Date().getTime()): void {
        const req: RequestEntry<X> = _req;

        // Note it as completed
        this.pending--;
        req.completeTime = now ?? new Date().getTime();

        // Unlink it from the list
        if (req.prev) req.prev.next = req.next;
        else this.head = req.next;

        if (req.next) req.next.prev = req.prev;
        else this.tail = req.prev;

        // Add it to the completed array
        this.completed.push(req);

        // Clean up history if needed
        if (this.completed.length > this.config.maxCompleted && this.config.autoCleanup) this.cleanupHistory(now);
    }

    public cleanupHistory(now = new Date().getTime()): number {
        // Purge everything at the front if we are too long
        let sliceCount = this.completed.length - this.config.maxCompleted;

        // Purge everything that is too old if needed
        if (this.config.maxCompletedMillis > 0) {
            const threshold = (now ?? new Date().getTime()) - this.config.maxCompletedMillis;
            while (this.completed[sliceCount].startTime < threshold) sliceCount++;
        }

        // Now actually splice the items off the array
        if (sliceCount > 0) this.completed.splice(0, sliceCount);

        return sliceCount;
    }

    public pendingRequests(): IterableIterator<TrackedRequest<X>> {
        let cur = this.head;
        const iterator = {
            [Symbol.iterator]() {
                return iterator;
            },

            next(): IteratorResult<TrackedRequest<X>> {
                if (!cur) return { done: true, value: null };
                const rv = { done: false, value: cur };
                cur = cur.next;
                return rv;
            }
        };
        return iterator;
    }

    public completedRequests(): Iterable<TrackedRequest<X>> {
        return this.completed;
    }

    public status(mapper = RequestTracker.DEFAULT_STATUS_MAPPER): StatusJson<X> {
        return {
            startTime: this.startTime,
            numTotalRequests: this.total,
            numPendingRequests: this.pending,
            pending: Array.from(this.pendingRequests(), mapper),
            completed: this.completed.map(mapper)
        };
    }
}
export default RequestTracker;
