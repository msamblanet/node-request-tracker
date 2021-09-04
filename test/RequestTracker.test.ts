import * as Lib from "../src/RequestTracker";
import LibDefault from "../src/RequestTracker";

const originalDateNow = Date.now;

test("Verify Exports", () => {
    expect(Lib.RequestTracker).not.toBeNull();

    expect(LibDefault).toEqual(Lib.RequestTracker);
})

test("Basic Function", () => {
    let now = 100;
    Date.now = function () { return now++; }
    try {
        const t = new Lib.RequestTracker();
        expect(t.startTime).toEqual(100);
        expect(t.numTotalRequests).toEqual(0);
        expect(t.numPendingRequests).toEqual(0);
        expect(Array.from(t.pendingRequests())).toMatchObject([]);
        expect(Array.from(t.completedRequests())).toMatchObject([]);
        expect(t.status()).toEqual({
            completed: [],
            numPendingRequests: 0,
            numTotalRequests: 0,
            pending: [],
            startTime: 100
        });

        const req = t.request("A", "B");
        expect(t.numTotalRequests).toEqual(1);
        expect(t.numPendingRequests).toEqual(1);
        expect(req).toMatchObject({ startTime: 101, desc: "A", meta: "B" });
        expect(Array.from(t.pendingRequests())).toMatchObject([{ startTime: 101, desc: "A", meta: "B" }]);
        expect(Array.from(t.completedRequests())).toMatchObject([]);
        expect(t.status()).toEqual({
            completed: [],
            numPendingRequests: 1,
            numTotalRequests: 1,
            pending: [{ startTime: 101, desc: "A", meta: "B" }],
            startTime: 100
        });

        t.completeRequest(req);
        expect(t.numTotalRequests).toEqual(1);
        expect(t.numPendingRequests).toEqual(0);
        expect(Array.from(t.pendingRequests())).toMatchObject([]);
        expect(Array.from(t.completedRequests())).toMatchObject([{ startTime: 101, completedTime: 102, desc: "A", meta: "B" }]);
        expect(t.status()).toEqual({
            completed: [{ startTime: 101, completedTime: 102, desc: "A", meta: "B" }],
            numPendingRequests: 0,
            numTotalRequests: 1,
            pending: [],
            startTime: 100
        });
    } finally {
        Date.now = originalDateNow;
    }
});

test("Out of Order Completion", () => {
    let now = 100;
    Date.now = function () { return now++; }
    try {
        const t = new Lib.RequestTracker();
        const reqs = [
            t.request("A", "B"),
            t.request("A2", "B2"),
            t.request("A3", "B3"),
            t.request("A4", "B4")
        ];

        expect(t.status()).toEqual({
            completed: [],
            numPendingRequests: 4,
            numTotalRequests: 4,
            pending: [
                { startTime: 101, desc: "A", meta: "B" },
                { startTime: 102, desc: "A2", meta: "B2" },
                { startTime: 103, desc: "A3", meta: "B3" },
                { startTime: 104, desc: "A4", meta: "B4" }
            ],
            startTime: 100
        });

        t.completeRequest(reqs[1]);
        t.completeRequest(reqs[3]);

        expect(t.status()).toEqual({
            completed: [
                { startTime: 102, completedTime: 105, desc: "A2", meta: "B2" },
                { startTime: 104, completedTime: 106, desc: "A4", meta: "B4" },
            ],
            numPendingRequests: 2,
            numTotalRequests: 4,
            pending: [
                { startTime: 101, desc: "A", meta: "B" },
                { startTime: 103, desc: "A3", meta: "B3" }
            ],
            startTime: 100
        });


        t.completeRequest(reqs[2]);
        t.completeRequest(reqs[0]);

        expect(t.status()).toEqual({
            completed: [
                { startTime: 102, completedTime: 105, desc: "A2", meta: "B2" },
                { startTime: 104, completedTime: 106, desc: "A4", meta: "B4" },
                { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                { startTime: 101, completedTime: 108, desc: "A", meta: "B" },
            ],
            numPendingRequests: 0,
            numTotalRequests: 4,
            pending: [],
            startTime: 100
        });

    } finally {
        Date.now = originalDateNow;
    }
});

test("Track", async () => {
    let now = 100;
    Date.now = function () { return now++; }
    try {
        const t = new Lib.RequestTracker();

        const rv = await t.track("A", "B", async (meta) => {
            expect(meta).toEqual("B");
            expect(t.status()).toEqual({
                completed: [],
                numPendingRequests: 1,
                numTotalRequests: 1,
                pending: [
                    { startTime: 101, completedTime: undefined, desc: "A", meta: "B" }
                ],
                startTime: 100
            });
            return "C";
        })

        expect(rv).toEqual("C");
        expect(t.status()).toEqual({
            completed: [
                { startTime: 101, completedTime: 102, desc: "A", meta: "B" }
            ],
            numPendingRequests: 0,
            numTotalRequests: 1,
            pending: [],
            startTime: 100
        });

    } finally {
        Date.now = originalDateNow;
    }
});

describe("Cleanup", () => {
    describe("Manual", () => {
        test("Empty", () => {
            let now = 100;
            Date.now = function () { return now++; }
            try {
                const t = new Lib.RequestTracker();
                t.cleanupHistory();
                expect(t.status()).toEqual({
                    completed: [],
                    numPendingRequests: 0,
                    numTotalRequests: 0,
                    pending: [],
                    startTime: 100
                });
            } finally {
                Date.now = originalDateNow;
            }
        });
        test("Count", () => {
            let now = 100;
            Date.now = function () { return now++; }
            try {
                const t = new Lib.RequestTracker({ autoCleanup: false, maxCompleted: 3, maxCompletedMillis: 0 });

                const reqs = [
                    t.request("A", "B"),
                    t.request("A2", "B2"),
                    t.request("A3", "B3"),
                    t.request("A4", "B4")
                ];
                reqs.forEach(x => t.completeRequest(x));

                expect(t.status()).toEqual({
                    completed: [
                        { startTime: 101, completedTime: 105, desc: "A", meta: "B" },
                        { startTime: 102, completedTime: 106, desc: "A2", meta: "B2" },
                        { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                        { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
                    ],
                    numPendingRequests: 0,
                    numTotalRequests: 4,
                    pending: [],
                    startTime: 100
                });

                t.cleanupHistory();
                expect(t.status()).toEqual({
                    completed: [
                        { startTime: 102, completedTime: 106, desc: "A2", meta: "B2" },
                        { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                        { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
                    ],
                    numPendingRequests: 0,
                    numTotalRequests: 4,
                    pending: [],
                    startTime: 100
                });

            } finally {
                Date.now = originalDateNow;
            }
        });

        test("Time", () => {
            let now = 100;
            Date.now = function () { return now++; }
            try {
                const t = new Lib.RequestTracker({ autoCleanup: false, maxCompleted: 100, maxCompletedMillis: 3 });

                const reqs = [
                    t.request("A", "B"),
                    t.request("A2", "B2"),
                    t.request("A3", "B3"),
                    t.request("A4", "B4")
                ];
                reqs.forEach(x => t.completeRequest(x));

                expect(t.status()).toEqual({
                    completed: [
                        { startTime: 101, completedTime: 105, desc: "A", meta: "B" },
                        { startTime: 102, completedTime: 106, desc: "A2", meta: "B2" },
                        { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                        { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
                    ],
                    numPendingRequests: 0,
                    numTotalRequests: 4,
                    pending: [],
                    startTime: 100
                });

                t.cleanupHistory();
                expect(t.status()).toEqual({
                    completed: [
                        { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                        { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
                    ],
                    numPendingRequests: 0,
                    numTotalRequests: 4,
                    pending: [],
                    startTime: 100
                });

            } finally {
                Date.now = originalDateNow;
            }
        });

        test("Both", () => {
            let now = 100;
            Date.now = function () { return now++; }
            try {
                const t = new Lib.RequestTracker({ autoCleanup: false, maxCompleted: 3, maxCompletedMillis: 3 });

                const reqs = [
                    t.request("A", "B"),
                    t.request("A2", "B2"),
                    t.request("A3", "B3"),
                    t.request("A4", "B4")
                ];
                reqs.forEach(x => t.completeRequest(x));

                expect(t.status()).toEqual({
                    completed: [
                        { startTime: 101, completedTime: 105, desc: "A", meta: "B" },
                        { startTime: 102, completedTime: 106, desc: "A2", meta: "B2" },
                        { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                        { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
                    ],
                    numPendingRequests: 0,
                    numTotalRequests: 4,
                    pending: [],
                    startTime: 100
                });

                t.cleanupHistory();
                expect(t.status()).toEqual({
                    completed: [
                        { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                        { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
                    ],
                    numPendingRequests: 0,
                    numTotalRequests: 4,
                    pending: [],
                    startTime: 100
                });

            } finally {
                Date.now = originalDateNow;
            }
        });
    });
});

test("Auto Cleanup", () => {
    let now = 100;
    Date.now = function () { return now++; }
    try {
        const t = new Lib.RequestTracker({ maxCompleted: 3 });

        const reqs = [
            t.request("A", "B"),
            t.request("A2", "B2"),
            t.request("A3", "B3"),
            t.request("A4", "B4")
        ];
        reqs.forEach(x => t.completeRequest(x));

        expect(t.status()).toEqual({
            completed: [
                { startTime: 102, completedTime: 106, desc: "A2", meta: "B2" },
                { startTime: 103, completedTime: 107, desc: "A3", meta: "B3" },
                { startTime: 104, completedTime: 108, desc: "A4", meta: "B4" },
            ],
            numPendingRequests: 0,
            numTotalRequests: 4,
            pending: [],
            startTime: 100
        });
    } finally {
        Date.now = originalDateNow;
    }
});
