
In `@lib/hooks/use-email-verification-realtime.ts` around lines 105 - 117, The  
code awaits a non-promise returned by channel.subscribe: remove the await on  
subscribePromise and the misleading comment, and rely on the subscription  
callback to set isSubscribedRef.current; locate the channel.subscribe(...) call  
and the subscribePromise variable in use-email-verification-realtime (and any  
surrounding logic referencing subscribePromise) and change it to const  
subscribeResult = channel.subscribe(...) (or just call channel.subscribe(...))  
without awaiting, or alternatively replace with a proper Promise that resolves  
when the callback receives status === "SUBSCRIBED" if you truly need to wait for  
the subscribed state.  


---