import { en } from "./en"
import type { LocaleMessages } from "./types"

const REQUEST_FAILED = /^Request failed \((\d+)\)$/

/**
 * Display-only mapping. The stored error string is unchanged.
 * Only a full exact match is rewritten. Unknown text is returned as-is.
 */
export function localizeKnownError(message: string, messages: LocaleMessages): string {
  switch (message) {
    case en.assistant.errorRateLimit:
      return messages.assistant.errorRateLimit
    case en.assistant.errorAuthFailure:
      return messages.assistant.errorAuthFailure
    case en.assistant.errorTimeout:
      return messages.assistant.errorTimeout
    case en.assistant.errorUnavailable:
      return messages.assistant.errorUnavailable
    case en.assistant.errorInvalidRequest:
      return messages.assistant.errorInvalidRequest
    case en.assistant.errorFailed:
      return messages.assistant.errorFailed
    case en.assistant.errorNoBody:
      return messages.assistant.errorNoBody
    case en.assistant.errorGeneric:
      return messages.assistant.errorGeneric
    default: {
      const requestFailed = REQUEST_FAILED.exec(message)
      if (requestFailed) {
        return messages.assistant.errorRequestFailed(Number(requestFailed[1]))
      }
      return message
    }
  }
}
