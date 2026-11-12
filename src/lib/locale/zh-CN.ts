import { en } from "./en"
import type { LocaleMessages } from "./types"

/**
 * Simplified Chinese catalog. Keys must match `en`.
 * `assistantPrompt` stays English except the reader-visible refusal sentence.
 * The system prompt builder does not translate the rest of that block.
 */
export const zhCN = {
  domain: {
    readingRoute: "场景",
    readingFrame: "阅读画幅",
    frameNarrative: "画幅叙述",
    routeSynopsis: "路线提要",
    readerStep: "阅读步",
    chapterMetadata: "章节信息",
    work: "作品",
    story: "故事",
  },
  meta: {
    title: "拉洋片",
    description: "再庞大的故事世界，也能一幕一幕读明白。",
  },
  home: {
    tagline: "再庞大的故事世界，也能一幕一幕读明白。",
    noWorks: "还没有作品。",
  },
  bookshelf: {
    openWorkAria: (title: string) => `打开${title}`,
    closeDialogAria: "关闭对话框",
  },
  readingRoute: {
    mapAlt: "维斯特洛与厄索斯地图",
    prevButton: "← 上一场景",
    nextButton: "下一场景 →",
    backToWork: "← 返回作品",
    prevAria: "上一场景",
    nextAria: "下一场景",
    unnamedWorkFallback: "未命名作品",
    unknownLocationFallback: "未知",
    routeProgress: (current: number, total: number) => `场景 ${current} / ${total}`,
  },
  readingFrame: {
    prevAria: "上一幅",
    nextAria: "下一幅",
    nextStoryImageAria: "下一张故事图",
    noImages: "没有图像",
    noImageYet: "暂无图像",
    emptyCaption: "（暂无图说）",
  },
  assistant: {
    panelTitle: "询问这个场景",
    emptyState: "可以问问这个场景、其中的人物，或这段故事。",
    inputPlaceholder: "输入问题…",
    send: "发送",
    stop: "停止",
    stopAria: "停止生成",
    stoppedLabel: "已停止",
    closeAria: "关闭",
    openFabAria: "打开场景助手",
    errorGeneric: "出了点问题",
    errorNoBody: "没有收到响应",
    errorRequestFailed: (status: number) => `请求失败（${status}）`,
    errorRateLimit: "生成暂时不可用（请求过于频繁）。",
    errorAuthFailure: "生成服务配置有误。",
    errorTimeout: "生成超时。",
    errorUnavailable: "生成服务暂时不可用。",
    errorInvalidRequest: "生成请求无效。",
    errorFailed: "生成失败。",
  },
  localeSwitch: {
    groupAria: "语言",
    en: "EN",
    zhCN: "中文",
  },
  character: {
    viewDetailsAria: (name: string) => `${name}，查看详情`,
    closeAria: "关闭",
    noDescription: "暂无介绍。",
    moreLabel: "更多",
    hiddenCast: "未显示的人物",
    moreCharactersTitle: (n: number) => `还有 ${n} 位人物`,
    noKnownHouse: "家族不详",
    unknownRegion: "地区不详",
  },
  location: {
    viewDetailsAria: (name: string) => `${name}，查看地点详情`,
    closeAria: "关闭",
    noDescription: "暂无介绍。",
    untitled: "未知地点",
    mapViewportAria: "地点地图。滚动缩放，拖动平移。",
    mapPanZoomHint: "滚动缩放 · 拖动平移",
  },
  navigation: {
    backToHomeAria: "回到首页",
    homeLabel: "首页",
  },
  assistantPrompt: {
    ...en.assistantPrompt,
    closedDomainRefusal: "就你目前读到的进度而言，这部分还没有揭晓。",
  },
} satisfies LocaleMessages
