import * as alt from 'alt-server';
import * as Athena from '@AthenaServer/api';
import { PaintShopView } from './src/view';

const PLUGIN_NAME = 'Paint Shop Plugin';

Athena.systems.plugins.registerPlugin(PLUGIN_NAME, () => {
    PaintShopView.init();
    alt.log(`~lg~CORE ==> ${PLUGIN_NAME} was Loaded`);
});
