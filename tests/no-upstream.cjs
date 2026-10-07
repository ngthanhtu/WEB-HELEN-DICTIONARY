// Used only in the real MySQL restart test: a durable hit must not call a provider.
global.fetch=async()=>{throw new Error('UPSTREAM_CALL_FORBIDDEN_AFTER_RESTART');};
