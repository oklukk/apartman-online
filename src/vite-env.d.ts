/// <reference types="vite/client" />
declare module 'virtual:apartman-art-catalog' {
  export const avatars: {id:string;file:string;description:string}[];
  export const anchors: {viewBox:number[];coordinateSpace:string;apartments:{number:number;floor:number;column:number;x:number;y:number;width:number;height:number}[]};
}
