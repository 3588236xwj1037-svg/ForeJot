import katexStyles from "katex/dist/katex.min.css?inline";
import amsRegular from "katex/dist/fonts/KaTeX_AMS-Regular.woff2?inline";
import caligraphicBold from "katex/dist/fonts/KaTeX_Caligraphic-Bold.woff2?inline";
import caligraphicRegular from "katex/dist/fonts/KaTeX_Caligraphic-Regular.woff2?inline";
import frakturBold from "katex/dist/fonts/KaTeX_Fraktur-Bold.woff2?inline";
import frakturRegular from "katex/dist/fonts/KaTeX_Fraktur-Regular.woff2?inline";
import mainBold from "katex/dist/fonts/KaTeX_Main-Bold.woff2?inline";
import mainBoldItalic from "katex/dist/fonts/KaTeX_Main-BoldItalic.woff2?inline";
import mainItalic from "katex/dist/fonts/KaTeX_Main-Italic.woff2?inline";
import mainRegular from "katex/dist/fonts/KaTeX_Main-Regular.woff2?inline";
import mathBoldItalic from "katex/dist/fonts/KaTeX_Math-BoldItalic.woff2?inline";
import mathItalic from "katex/dist/fonts/KaTeX_Math-Italic.woff2?inline";
import sansSerifBold from "katex/dist/fonts/KaTeX_SansSerif-Bold.woff2?inline";
import sansSerifItalic from "katex/dist/fonts/KaTeX_SansSerif-Italic.woff2?inline";
import sansSerifRegular from "katex/dist/fonts/KaTeX_SansSerif-Regular.woff2?inline";
import scriptRegular from "katex/dist/fonts/KaTeX_Script-Regular.woff2?inline";
import size1Regular from "katex/dist/fonts/KaTeX_Size1-Regular.woff2?inline";
import size2Regular from "katex/dist/fonts/KaTeX_Size2-Regular.woff2?inline";
import size3Regular from "katex/dist/fonts/KaTeX_Size3-Regular.woff2?inline";
import size4Regular from "katex/dist/fonts/KaTeX_Size4-Regular.woff2?inline";
import typewriterRegular from "katex/dist/fonts/KaTeX_Typewriter-Regular.woff2?inline";

const katexFontUrls: Record<string, string> = {
  "KaTeX_AMS-Regular.woff2": amsRegular,
  "KaTeX_Caligraphic-Bold.woff2": caligraphicBold,
  "KaTeX_Caligraphic-Regular.woff2": caligraphicRegular,
  "KaTeX_Fraktur-Bold.woff2": frakturBold,
  "KaTeX_Fraktur-Regular.woff2": frakturRegular,
  "KaTeX_Main-Bold.woff2": mainBold,
  "KaTeX_Main-BoldItalic.woff2": mainBoldItalic,
  "KaTeX_Main-Italic.woff2": mainItalic,
  "KaTeX_Main-Regular.woff2": mainRegular,
  "KaTeX_Math-BoldItalic.woff2": mathBoldItalic,
  "KaTeX_Math-Italic.woff2": mathItalic,
  "KaTeX_SansSerif-Bold.woff2": sansSerifBold,
  "KaTeX_SansSerif-Italic.woff2": sansSerifItalic,
  "KaTeX_SansSerif-Regular.woff2": sansSerifRegular,
  "KaTeX_Script-Regular.woff2": scriptRegular,
  "KaTeX_Size1-Regular.woff2": size1Regular,
  "KaTeX_Size2-Regular.woff2": size2Regular,
  "KaTeX_Size3-Regular.woff2": size3Regular,
  "KaTeX_Size4-Regular.woff2": size4Regular,
  "KaTeX_Typewriter-Regular.woff2": typewriterRegular,
};

export const katexExportStyles = katexStyles
  .replace(
    /src:url\((data:font\/woff2[^)]*)\)\s*format\("woff2"\),\s*url\([^)]*\.woff[^)]*\)\s*format\("woff"\),\s*url\([^)]*\.ttf[^)]*\)\s*format\("truetype"\)/g,
    'src:url($1) format("woff2")',
  )
  .replace(
    /src:url\(([^)]*\.woff2[^)]*)\)\s*format\("woff2"\),\s*url\([^)]*\.woff[^)]*\)\s*format\("woff"\),\s*url\([^)]*\.ttf[^)]*\)\s*format\("truetype"\)/g,
    (_source, sourceUrl: string) => {
      const fileName = Object.keys(katexFontUrls).find((name) => sourceUrl.includes(name.slice(0, -6)));
      const fontUrl = fileName ? katexFontUrls[fileName] : null;
      if (!fontUrl) throw new Error(`Missing embedded KaTeX font for: ${sourceUrl}`);
      return `src:url("${fontUrl}") format("woff2")`;
    },
  );
