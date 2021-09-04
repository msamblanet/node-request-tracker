# Node Request Tracker
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

This repository is part of a collection of my personal node.js libraries and templates.  I am making them available to the public - feel free to offer suggestions, report issues, or make PRs via GitHub.

This library provides some basic classes for tracking inbound and outbound requests from a server for the purpose of debugging and admin diagnostics.  A basic implementation for Express is provided.

## Usage:

### Express

For express you must install the optional dependencies:

```npm i express-headers```

```javascript
import { ExpressTracker } from "@msamblanet/node-request-tracker";
import config from "config";

const tracker = new ExpressTracker(config?.express?.tracker);

const app = new Express();
app.use(tracker);

// Setup your express app here

// When ready to inspect the data:
const startTime = tracker.startTime; // Time the tracker started
const total = tracker.numTotalRequests;
const pending = tracker.numPendingRequests;
const status = tracker.status(); // A simple object will all the status - suitable for JSON.stringify

for (const req of tracker.pendingRequests) { } // Iterate over all pending requests
for (const req of tracker.completedRequests) { } // Iterate over all completed requests
```

### Outbound HTTP calls

```javascript
import { RequestTracker } from "@msamblanet/node-request-tracker";
import config from "config";

type ModuleMetadata = {
    a: string,
    b?: number
}
const tracker = new RequestTracker<string>(config?.yourModule?.tracker);

// When time to make your API call:
const meta = { a: "Test" };
const result: string = tracker.track("Some Description of this call", , async () => Promise<string>
    const rv = api.makeYourApiCall();
    b = Date.now();
    return rv;
});

// Consume this the same way as the express example...
```

## API

#### RequestTracker(config...)

Constructs a new request tracker.  Configuration options are:

- maxCompleted - Maximum number of completed records to track - default is 50
- maxCompletedMillis - Any completed request over this many milliseconds past complete is subject to removal from the completion list - default is 5 minutes
- autoCleanup - if true (default) then the completed history will be automatically purged when it fills up.  Set to false to either keep unlimited history or to manually control cleanup (via the cleanupHistory method).

#### RequestTracker.request(desc, meta)

Begins tracking a request.  ```desc``` is a string description and ```meta``` is custom metadata on the request for use by consumers of the tracker.  Save the return value and call ```completeRequest``` wiehn it is done.

#### RequestTracker.track(desc, meta, action)

Tracks a request that is implemented by action.  Allows the RequestTracker to manage the details of managing the tracking.

Action receives ```meta``` as a parameter and must return a Promise.

#### RequestTracker.completeRequest(req)

Makes a request as complete.  ```req``` is the return value from request.

#### RequestTracker.cleanupHistory()

Allows you to manually request cleaning up of the history.  Normally you do not need to call this and it will be called automatically when the completed history gets too long.

If you are saving a very large number of completed history records, you may wish to call this manually and set the ```autoCleanup``` option to false to ensure a more predictable impact on performance.

#### RequestTracker.pendingRequests()

Returns an iterable of all the currently pending requests.

#### RequestTracker.completedRequests()

Returns an Iterable of all the remembered completed requests.

### ExpressTracker

A basic subclass of RequestTracker that exposes a middleware method to inject into express (or any compatible HTTP middleware engine).  Relies on the optional dependency ```express-headers``` for it's implementation.

#### Configuration

ExpressTracker uses the same configuration as RequestTracker.

#### ExpressTracker.expressMiddleware

A middleware method to track all express requests.  The result info includes the following:

- desc - the URL of the request
- meta.statusCode - Status code from the response
- meta.contentType - MIME type of the response
