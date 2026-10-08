// First visual direction: urban, high contrast, with restrained lime/violet accents.
export const palette={
 canvas:'#F5F5F7',surface:'#FFFFFF',ink:'#17171C',muted:'#62626D',line:'#E5E5EB',
 lime:'#D4FF38',violet:'#6929DD',violetSoft:'#F0E9FF',soft:'#EEEEF3',onDark:'#FFFFFF',
 darkMuted:'#ADADB8',error:'#B42332',
} as const;

// Un color por categoría de lugar (opción "Neón"). El texto sobre ellos siempre va en palette.ink.
export const categoryColors:Record<string,string>={Comer:'#FF9F1C',Divertirse:'#C26BFF',Explorar:'#2DE2C0'};
export const categoryColor=(category:string)=>categoryColors[category]||palette.soft;
