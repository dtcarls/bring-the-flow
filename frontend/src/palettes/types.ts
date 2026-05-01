export interface PaletteColor {
  hex: string;
  weight: number;
}

export interface Palette {
  id: string;
  name: string;
  colors: PaletteColor[];
  background: string | null;
  inspiredBy: string | null;
}
