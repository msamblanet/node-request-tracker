import { Config, Override, BaseConfigurable } from "@msamblanet/node-config-types";

export interface RequestTrackerConfig extends Config {
    maxCompleted: number
    maxCompletedMillis: number
    autoCleanup: boolean
}
export type RequestTrackerConfigOverride = Override<RequestTrackerConfig>

export interface TrackedRequest<X> {
    readonly startTime: number
    readonly completedTime?: number
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
    public next?: RequestEntry<X>
    public prev?: RequestEntry<X>

    public readonly startTime: number
    public completedTime?: number
    public readonly desc: string
    public readonly meta: X

    public constructor(desc: string, meta: X) {
        this.desc = desc;
        this.meta = meta;
        this.startTime = Date.now();
    }
}

export class RequestTracker<X> extends BaseConfigurable<RequestTrackerConfig> {
    public static readonly DEFAULT_CONFIG: RequestTrackerConfig = {
        maxCompleted: 50,
        maxCompletedMillis: 5 * 60 * 1000,
        autoCleanup: true
    }
    public static readonly DEFAULT_STATUS_MAPPER = <Y>(entry: RequestEntry<Y>): TrackedRequest<Y> => ({
        startTime: entry.startTime,
        completedTime: entry.completedTime,
        desc: entry.desc,
        meta: entry.meta
    })

    public readonly startTime = Date.now()
    protected head: RequestEntry<X> | undefined = undefined
    protected tail: RequestEntry<X> | undefined = undefined
    protected completed: Array<RequestEntry<X>> = []
    protected total = 0
    protected pending = 0

    public get numTotalRequests(): number { return this.total }
    public get numPendingRequests(): number { return this.pending }

    constructor(...config: RequestTrackerConfigOverride[]) {
        super(RequestTracker.DEFAULT_CONFIG, ...config);
    }

    public request(desc: string, meta: X): TrackedRequest<X> {
        // Create a request
        const req = new RequestEntry<X>(desc, meta);

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

    public completeRequest(_req: TrackedRequest<X>): void {
        const req: RequestEntry<X> = _req;

        // Note it as completed
        this.pending--;
        req.completedTime = Date.now();

        // Unlink it from the list
        if (req.prev) req.prev.next = req.next;
        else this.head = req.next;

        if (req.next) req.next.prev = req.prev;
        else this.tail = req.prev;

        // Add it to the completed array
        this.completed.push(req);

        // Clean up history if needed
        if (this.completed.length > this.config.maxCompleted && this.config.autoCleanup) this.cleanupHistory();
    }

    public cleanupHistory(): number {
        // Purge everything at the front if we are too long
        let sliceCount = this.completed.length - this.config.maxCompleted;
        if (sliceCount < 0) sliceCount = 0;

        // Purge everything that is too old if needed
        if (this.config.maxCompletedMillis > 0) {
            const threshold = Date.now() - this.config.maxCompletedMillis;
            while (this.completed[sliceCount]?.completedTime as number <= threshold) sliceCount++;
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
