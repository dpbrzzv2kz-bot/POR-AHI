export type CameraShot={uri:string;type:'image'|'video';mimeType:string;duration?:number};
export type StoryCameraProps={onCapture:(shot:CameraShot)=>void;onGallery:()=>void;onClose:()=>void};
