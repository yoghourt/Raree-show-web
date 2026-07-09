/**
 * SPEC-VDC-001 Phase 4a — canonical en locale (reader-facing).
 * All normative Runtime concept English strings must originate here.
 */

export const en = {
  domain: {
    readingRoute:    'Reading route',
    readingFrame:    'Reading frame',
    frameNarrative:  'Frame narrative',
    routeSynopsis:   'Route synopsis',
    readerStep:      'Reader step',
    chapterMetadata: 'Chapter metadata',
    work:            'Work',
    story:           'Story',
  },
  meta: {
    title:       'Raree Show',
    description: 'Step inside complex worlds, one reading route at a time.',
  },
  home: {
    tagline: 'Step inside complex worlds, one reading route at a time.',
    noWorks: 'No works yet.',
  },
  bookshelf: {
    openWorkAria: (title: string) => `Open ${title}`,
    closeDialogAria: 'Close dialog',
  },
  readingRoute: {
    mapAlt: 'Map of Westeros and Essos',
    prevButton: '← prev',
    nextButton: 'Next reading route →',
    backToWork: '← Back to work',
    prevAria: 'Previous reading route',
    nextAria: 'Next reading route',
    unnamedWorkFallback: 'Untitled work',
    unknownLocationFallback: 'Unknown',
    routeProgress: (current: number, total: number) =>
      `Route ${current} / ${total}`,
  },
  readingFrame: {
    prevAria: 'Previous reading frame',
    nextAria: 'Next reading frame',
    nextStoryImageAria: 'Next story image',
    noImages: 'No images',
  },
  assistant: {
    panelTitle: 'Ask about this reading route',
    emptyState:
      'Ask a question about this reading route, characters, or the story.',
    inputPlaceholder: 'Ask a question…',
    send: 'Send',
    closeAria: 'Close',
    openFabAria: 'Open reading route assistant',
    errorGeneric: 'Something went wrong',
    errorNoBody: 'No response body',
    errorRequestFailed: (status: number) => `Request failed (${status})`,
  },
  character: {
    viewDetailsAria: (name: string) => `${name}, view details`,
    closeAria: 'Close',
    noDescription: 'No description available.',
    moreLabel: 'More',
    hiddenCast: 'Hidden cast',
    moreCharactersTitle: (n: number) => `${n} more characters`,
    noKnownHouse: 'No known house',
    unknownRegion: 'Unknown region',
  },
  navigation: {
    backToHomeAria: 'Back to home',
    homeLabel: 'HOME',
  },
  assistantPrompt: {
    retrievalIdOnlyFallback:
      'Retrieval result contains only reading route id and title.',
    emptyRevealedStory: '(No revealed story yet)',
    emptyCaption: '(No caption)',
    untitledWork:
      '(Work title not provided; rely on Raree-injected material only)',
    closedDomainRefusal:
      'Based on your progress so far, that information has not been revealed yet.',
    chapterLine: (chapterNumber: number, chapterTitle?: string | null) =>
      chapterTitle != null && chapterTitle !== ''
        ? `Chapter ${chapterNumber} · ${chapterTitle}`
        : `Chapter ${chapterNumber}`,
    personaIntro:
      'You are the Raree Show Reading Route Assistant (immersive multi-work reading companion).',
    boundaryNote:
      'Semantic retrieval topology is unchanged: candidate reading routes remain gated by reading-progress SQL; Raree story text below is physically truncated server-side by progress — captions that do not appear are not yet revealed.',
    revealedNarrativeIntro:
      'The blocks below are reader-revealed content: (1) current reading route metadata and physically truncated revealed story; (2) same-chapter revealed reading-route context (read-only DB assembly, not a second semantic retrieval pass); (3) semantic retrieval supplements inside `<context>` (current route tsid excluded to avoid whole-route RAG text bypassing story truncation).',
    toneNote:
      'Tone: calm, solemn, epic in scale — matched to the current work. Answer in at most two sentences.',
    currentRouteHeader: 'Current reading route',
    currentRevealedStoryHeader: 'Current route revealed story (physically truncated)',
    sameChapterHeader: 'Same-chapter revealed reading-route context',
    semanticContextHeader: 'Semantic retrieval supplement (`<context>`)',
    labelWork: 'Work',
    labelTitle: 'Title',
    labelLocation: 'Location',
    labelCharacters: 'Characters',
    labelSummary: 'Summary (secondary, may be empty)',
    currentWorkRaree: (workLine: string) =>
      `**Current work (Raree):** ${workLine}`,
    progressBoundary:
      'All plot boundaries follow Raree-injected revealed material in this prompt; do not assume the reader is in a specific famous IP unless the work name or injected text clearly indicates it.',
  },
} as const;

export type EnLocale = typeof en;
