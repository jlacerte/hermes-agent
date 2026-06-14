// Logger structuré minimaliste — émet des lignes JSON sur stdout/stderr (journal systemd)
// Format: {ts, level, scope, msg, ...extra}

function emit(level, scope, msg, extra = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    ...extra,
  };
  const line = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logInfo(scope, msg, extra = {}) {
  emit("INFO", scope, msg, extra);
}

export function logWarn(scope, msg, extra = {}) {
  emit("WARN", scope, msg, extra);
}

export function logError(scope, msg, extra = {}) {
  emit("ERROR", scope, msg, extra);
}
