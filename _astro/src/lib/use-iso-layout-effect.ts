import { useEffect, useLayoutEffect } from "react";

// SSR で useLayoutEffect が出す警告を回避するための iso 変種。
// サーバ環境 (window 不在) では useEffect、クライアントでは
// useLayoutEffect にディスパッチする。
//
// 利用元はいずれも "use client" component で、paint 前に DOM 副作用を
// 同期実行したいケース (ScrollMemory のスクロール位置復元、NavState の
// .is-scrolled 事前付与など) で使う。
export const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;
