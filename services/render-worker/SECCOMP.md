# Chromium sandbox profile

`seccomp-base.json` is vendored from Moby profiles, revision
`61eaf32614c7c71b60bd8927d3e6a4ffc8ff1f31`:
https://github.com/moby/profiles/blob/61eaf32614c7c71b60bd8927d3e6a4ffc8ff1f31/seccomp/default.json

`seccomp.json` retains default ERRNO and the upstream syscall filters, with
exactly this delta: replace clone/clone3/unshare/setns entries with unconditional
ALLOW for clone, unshare, setns and ENOSYS (38) for clone3. This permits Chromium
to create its unprivileged user namespace sandbox without CAP_SYS_ADMIN or an
unconfined container. clone3 falls back to clone. Namespace capabilities obtained
in a new user namespace do not grant NET_ADMIN in the original job namespace.

Both files are checked in for review. When updating the base, regenerate this
same small delta, diff it, and rerun Linux acceptance. Never add SYS_ADMIN,
NET_ADMIN, `--no-sandbox`, `seccomp=unconfined`, or disable the sandbox to make an
unsupported host pass. Host support for unprivileged user namespaces is required.

The base profile is Apache-2.0 licensed; see `SECCOMP-LICENSE`.
