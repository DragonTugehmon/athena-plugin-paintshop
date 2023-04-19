import * as alt from 'alt-shared';
import { RGB } from '../shared/rgb';

export interface iPaintshopSync {
    color: number | RGB;
    color2: number | RGB;
    pearl: number;
    //finish1: number;
    //finish2: number;
}

export interface IPaintShop {
    uid: string;
    cost: number;
    vertices: Array<alt.IVector3>;
}
