/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SDK_APP_ID?: string;
  readonly VITE_USER_SIG_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}
