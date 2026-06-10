---
'ignite-parleyjs': patch
---

Fixed disconnect notifications tearing down the wrong connection: the handler
now disconnects the target that actually sent the notification (identified via
message metadata) instead of the first connected target. With multiple connected
targets, one peer disconnecting no longer kills an unrelated connection.
