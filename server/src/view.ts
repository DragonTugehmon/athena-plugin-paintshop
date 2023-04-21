import * as alt from 'alt-server';
import * as Athena from '@AthenaServer/api';
import { Paintshop_View_Events } from '../../shared/events';
import { IPaintShop, iPaintshopSync } from '../../shared/interfaces';
import { VEHICLE_COLOR_PAINTS } from '../../shared/paints';
import { PAINT_SHOPS } from './shops';
import { PAINTSHOP_LOCALE } from '../../shared/locales';
import { PolygonShape } from '@AthenaServer/extensions/extColshape';
import { SYSTEM_EVENTS } from '@AthenaShared/enums/system';

const shops: Array<IPaintShop> = [];
const inShop = {};

class InternalFunctions {
    /**
     * Update the vehicle paint based on data.
     * @param vehicle - The vehicle to update.
     */
    static updatePaint(vehicle: alt.Vehicle) {
        const vehicleData = Athena.document.vehicle.get(vehicle);
        if (!vehicleData?.tuning) return;
        // Athena.vehicle?.tuning ?

        if (vehicleData.state.primaryColor && !vehicleData.state.secondaryColor)
            vehicleData.state.secondaryColor = vehicleData.state.primaryColor;

        if (vehicleData.state.secondaryColor && !vehicleData.state.primaryColor)
            vehicleData.state.primaryColor = vehicleData.state.secondaryColor;
        if (vehicleData.state.primaryColor) {
            vehicle.primaryColor = vehicleData.state.primaryColor;
        }

        if (vehicleData.state.secondaryColor) {
            vehicle.secondaryColor = vehicleData.state.secondaryColor;
        }
    }

    static previewPaint(
        player: alt.Player,
        color: alt.RGBA | number,
        color2: alt.RGBA | number,
        finish1: number,
        finish2: number,
        pearl: number = -1,
    ) {
        if (!inShop[player.id]) {
            return;
        }

        if (!player.vehicle) {
            return;
        }

        if (typeof color === 'number') {
            player.vehicle.primaryColor = color as number;
            player.vehicle.secondaryColor = color2 as number;
        } else {
            player.vehicle.primaryColor = finish1;
            player.vehicle.secondaryColor = finish2;

            player.vehicle.customPrimaryColor = color as alt.RGBA;
            player.vehicle.customSecondaryColor = color2 as alt.RGBA;

            if (pearl >= 0) {
                player.vehicle.pearlColor = pearl;
            }
        }
    }
}

export class PaintShopView {
    static init() {
        for (let i = 0; i < PAINT_SHOPS.length; i++) {
            PaintShopView.register(PAINT_SHOPS[i]);
        }

        alt.onClient(Paintshop_View_Events.PREVIEW_PAINT, InternalFunctions.previewPaint);
        alt.onClient(Paintshop_View_Events.OPEN, PaintShopView.open);
        alt.onClient(Paintshop_View_Events.PURCHASE, PaintShopView.purchase);
        alt.onClient(Paintshop_View_Events.CLOSE, PaintShopView.close);
        Athena.events.vehicle.on('vehicle-spawned', InternalFunctions.updatePaint);
    }

    /**
     * Update the vehicle's paintjob and remove the player from the inShop array.
     * Restores the previous paint job that was applied to the vehicle.
     * @param player - alt.Player - The player who is opening the paint shop.
     * @returns Nothing.
     */
    static close(player: alt.Player) {
        if (!player.vehicle) {
            return;
        }

        InternalFunctions.updatePaint(player.vehicle);
        delete inShop[player.id];
    }

    /**
     * Register a Vehicle Paint Shop
     * @static
     * @param {IPaintShop} shop
     * @return {*}  {string}
     * @memberof PaintShopView
     */
    static register(shop: IPaintShop): string {
        if (!shop.uid) {
            shop.uid = Athena.utility.hash.sha256Random(JSON.stringify(shop));
        }

        const index = shops.findIndex((x) => x.uid === shop.uid);
        if (index >= 0) {
            console.error(new Error(`Shop with ${shop.uid} is a duplicate.`));
            return null;
        }

        Athena.controllers.blip.append({
            text: PAINTSHOP_LOCALE.PAINTSHOP_LABEL,
            color: 48,
            sprite: 72,
            scale: 1,
            shortRange: true,
            pos: shop.vertices[0],
            uid: `paint-shop-${shop.uid}`,
        });

        const polygon = new Athena.extensions.PolygonShape(
            shop.vertices[0].z - 2.5,
            shop.vertices[0].z + 2.5,
            shop.vertices,
            true,
            false,
        );

        Athena.controllers.interaction.append({
            uid: `paint-shop-${shop.uid}`,
            position: shop.vertices[0],
            description: 'Paint Vehicle Press shift + E',
            debug: false,
        });

        polygon.addEnterCallback(PaintShopView.enter);
        polygon.addLeaveCallback(PaintShopView.leave);
        return shop.uid;
    }

    /**
     * When the player enters the polygon, they will be able to open the paint shop.
     * This function is triggered when a player has entered the PolygonShape.
     * @param {PolygonShape} polygon - PolygonShape
     * @param player - alt.Player
     * @returns Nothing.
     */
    static enter(polygon: PolygonShape, player: alt.Player) {
        if (!(player instanceof alt.Player)) {
            return;
        }

        if (!player.vehicle) {
            Athena.player.emit.notification(player, PAINTSHOP_LOCALE.MUST_BE_IN_A_VEHICLE);
            return;
        }

        if (Athena.vehicle.tempVehicles.has(player.vehicle)) {
            Athena.player.emit.notification(player, PAINTSHOP_LOCALE.CANNOT_BE_MODIFIED);
            return;
        }

        if (player.vehicle.driver.id !== player.id) {
            return;
        }

        function callback() {
            console.log(`User pressed a key after entering the area!`);
        }

        inShop[player.id] = true;

        Athena.player.emit.sound2D(player, 'shop_enter', 0.5);

        /*
        Athena.player.emit.interactionAdd(player, {
            keyPress: 'E',
            description: PAINTSHOP_LOCALE.OPEN_MENU,
            uid: polygon.uid,
        });
        */

        alt.log('player key work');

        alt.emitClient(player, SYSTEM_EVENTS.INTERACTION_TEMPORARY, Paintshop_View_Events.OPEN);
    }

    /**
     * When a player leaves the shop, the shop will be removed from the player's interaction list.
     * Removes all temporary interactions that were created in the PolygonShape.
     * @param {PolygonShape} polygon - The polygon that the player is leaving.
     * @param player - alt.Player - The player that is leaving the shop.
     * @returns Nothing.
     */
    static leave(polygon: PolygonShape, player: alt.Player) {
        if (!(player instanceof alt.Player)) {
            return;
        }

        inShop[player.id] = false;
        delete inShop[player.id];
        alt.emitClient(player, SYSTEM_EVENTS.INTERACTION_TEXT_REMOVE, polygon.uid);
        alt.emitClient(player, SYSTEM_EVENTS.INTERACTION_TEMPORARY, null);
    }

    /**
     * Opens the paint shop for the player
     * @param player - alt.Player
     * @returns The `alt.emitClient` function returns a `Promise` object.
     */
    static open(player: alt.Player) {
        if (!player.vehicle || player.vehicle.driver !== player) {
            return;
        }
        const vehicleData = Athena.document.vehicle.get(player.vehicle);
        if (!vehicleData || Athena.vehicle.tempVehicles.has(player.vehicle)) {
            return;
        }

        const playerData = Athena.document.character.get(player);
        if (vehicleData.owner !== playerData._id) {
            return;
        }
        /*
        if (!Athena.vehicle.funcs.hasOwnership(player, player.vehicle)) {
            return;
        }
        */

        if (!inShop[player.id]) {
            return;
        }
        const syncData: iPaintshopSync = {
            color:
                typeof vehicleData.state?.primaryColor === 'object' //
                    ? vehicleData.state.primaryColor
                    : { r: 255, g: 255, b: 255 },
            color2:
                typeof vehicleData.state?.secondaryColor === 'object' //
                    ? vehicleData.state.secondaryColor
                    : { r: 255, g: 255, b: 255 },
            /*
            finish1:
                typeof vehicleData.state?.primaryFinish === 'number' //
                    ? vehicleData.state.primaryFinish
                    : VEHICLE_COLOR_PAINTS.MATTE,
            finish2:
                typeof vehicleData.state?.secondaryFinish === 'number' //
                    ? vehicleData.state.secondaryFinish
                    : VEHICLE_COLOR_PAINTS.MATTE,
            */
            pearl:
                typeof vehicleData.state?.pearlColor === 'number' //
                    ? vehicleData.state.pearlColor
                    : 0,
        };

        alt.emitClient(player, Paintshop_View_Events.OPEN, syncData);
    }

    /**
     * It takes in a player, the color, color2, finish1, finish2, and pearl and updates the vehicle's
     * color, color2, finish1, finish2, and pearl
     * @param player - alt.Player - The player who is purchasing the vehicle.
     * @param {alt.RGBA | number} color - The primary color of the vehicle.
     * @param {alt.RGBA | number} color2 - The second color of the vehicle.
     * @param {number} finish1 - number
     * @param {number} finish2 - number
     * @param {number} pearl - number
     * @returns Nothing.
     */
    static purchase(
        player: alt.Player,
        color: number | alt.RGBA,
        color2: number | alt.RGBA,
        finish1: number,
        finish2: number,
        pearl: number,
    ) {
        if (!player.vehicle || player.vehicle.driver !== player) {
            return;
        }

        if (!inShop[player.id]) {
            return;
        }

        /*
        if (player.vehicle.isTemporary) {
            return;
        }
        */

        /*
        if (!Athena.vehicle.funcs.hasOwnership(player, player.vehicle)) {
            return;
        }
        */

        const vehicleData = Athena.document.vehicle.get(player.vehicle);
        const playerData = Athena.document.character.get(player);
        if (vehicleData.owner !== playerData._id) {
            return;
        }

        if (color !== undefined && color !== null) {
            if (!vehicleData.tuning) vehicleData.tuning = {};
            (vehicleData.state.primaryColor = 0), 0, 0, 0; //color
        }

        if (color2 !== undefined && color2 !== null) {
            if (!vehicleData.tuning) vehicleData.tuning = {};
            (vehicleData.state.secondaryColor = 0), 0, 0, 0; //color2
        }
        /*
        if (finish1 !== undefined && finish1 !== null) {
            if (!vehicleData.tuning) vehicleData.tuning = {};
            player.vehicle.data.tuning.primaryFinish = finish1;
        }

        if (finish2 !== undefined && finish2 !== null) {
            if (!vehicleData.tuning) vehicleData.tuning = {};
            player.vehicle.data.tuning.secondaryFinish = finish2;
        }
        */

        if (pearl !== undefined && pearl !== null) {
            if (!vehicleData.tuning) vehicleData.tuning = {};
            vehicleData.state.pearlColor = pearl;
        }

        InternalFunctions.updatePaint(player.vehicle);
        Athena.document.vehicle.set(player.vehicle, 'vehicle', vehicleData);
    }
}
