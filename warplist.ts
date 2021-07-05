

import { RelativeFloat, Vec3 } from 'bdsx/bds/blockpos';
import { ActorWildcardCommandSelector } from 'bdsx/bds/command';
import { CustomForm, FormButton, FormDropdown, FormInput, FormStepSlider, ModalForm, SimpleForm } from 'bdsx/bds/form';
import { Player, ServerPlayer } from 'bdsx/bds/player';
import { events } from 'bdsx/event';
import { CxxString, int32_t } from 'bdsx/nativetype';
import fs = require('fs');
import { DimensionId } from '../bdsx/bds/actor';
import { NetworkIdentifier } from '../bdsx/bds/networkidentifier';
import { command } from '../bdsx/command';
import { connectionList } from './playerlist';
import { tdTeleport, RelPos } from './tdtp';
const perms = require(`${__dirname}/perms.json`);
let dbFile = "warplist.json";   /* database file location */
let warpDB: any = []
let system = server.registerSystem(0,0);
let homename: string = '§5HOME';

declare module "bdsx/bds/player" {
    interface Player {
        getPlayerDB(): {playerDB: PlayerDBEntry, index: number} | undefined
    }
}
// Load Database File on Server Start
fs.readFile(dbFile, (err, data: any) =>{
    console.log('[WARP LIST] Database ' + dbFile + ' LOADED');
    if (data){
        warpDB = JSON.parse(data);
        let _filedata = JSON.stringify(warpDB, null, 2);
        // console.log(_filedata);
    }
});

// Save Database File on Server Shutdown
system.shutdown = function(){
    saveToFile();
}

events.serverClose.on(() => {
    saveToFile();
});

// Register Commands

// /warplist
command.register('warplist', '§bList§7 your Warp Points.', perms.warpList).overload((param, origin, output) => {
    if (origin.getName() != undefined && origin.getName() != '!Â§r') {
        let playerNetID: NetworkIdentifier = connectionList.nXNet.get(origin.getName());
        let playerActor: Player = playerNetID.getActor() as Player;
        if (playerActor != null) {
            if (perms.formGUI == true) {
                warpListForm(origin.getName());
            } else {
                warpList(playerActor)
            }
            return 0
        }
        return 0
    }
    return 0
},{});

// /warpedit <warpName> [newWarpName] [newListPos]
command.register('warpedit', '§9Edit§7 a Warp Point.', perms.warpEdit).overload((param, origin, output) => {
    let listIndex = param.newListPos;
    let newName = param.newWarpName;
    if (newName == "") { newName = param.warpName};
    if (param.newListPos !== undefined) { listIndex = param.newListPos - 1 };
    if (param.newWarpName !== undefined || param.newListPos !== undefined) {
        warpEdit(origin.getName(), param.warpName, newName, listIndex, perms.formGUI);
    } else if (perms.formGUI == true) {
        let originXuid = connectionList.nXXid.get(origin.getName());
        let dbObject = warpDB.find((obj: { xuid: string; }) => obj.xuid == originXuid);
        let dbIndex = warpDB.indexOf(dbObject);
        let warpObject = dbObject.warp.find((obj: { name: string; }) => obj.name == param.warpName);
        let warpIndex = warpDB[dbIndex].warp.indexOf(warpObject);
        warpItemForm(origin.getName(), warpIndex)
    }
},{warpName: CxxString, newWarpName: [CxxString, true], newListPos: [int32_t, true]})

// /warpdel <warpName>
command.register('warpdel', '§cDelete§7 a Warp Point.', perms.warpDel).overload((param, origin, output) => {
    if(param.warpName != undefined) { warpDel(origin.getName(), param.warpName, perms.formGUI) };
},{warpName: CxxString});

// /warpto <warpName>
command.register('warpto', '§aWarp§7 to a Warp Point.', perms.warpTo).overload((param, origin, _output) => {
    if (origin.getName() != undefined && origin.getName() != '!Â§r') {
        let playerNetID: NetworkIdentifier = connectionList.nXNet.get(origin.getName());
        let playerActor: Player = playerNetID.getActor() as Player;
        if (playerActor != null && param.warpName != undefined) {
            warpTo(playerActor.getName(), param.warpName);
        }
        return 0
    }
    return 0

},{warpName: CxxString});

// /warpset <warpName>
command.register('warpset', '§eSet§7 a Warp Point.', perms.warpSet).overload((param, origin, _output) => {
    if (origin.getName() != undefined && origin.getName() != '!Â§r') {
        let playerNetID: NetworkIdentifier = connectionList.nXNet.get(origin.getName());
        let playerActor: Player = playerNetID.getActor() as Player;
        if (playerActor != null) {
            let cmdPos: Vec3 = playerActor.getPosition()
            let dimId = playerActor.getDimensionId()
            warpAdd(playerActor.getName(), param.warpName, new RelPos(cmdPos.x), new RelPos(cmdPos.y), new RelPos(cmdPos.z), dimId)
        }
        return 0
    }
    return 0

},{warpName: CxxString});

// /warpadd <playerName> <warpName> <x> <y> <z> <dimensionId>
command.register('warpadd', '§6Add§7 a Warp Point for any player at any position.', perms.warpAdd).overload((param, origin, _output) => {
    let cmdPos = origin.getWorldPosition();
    let xPos: RelPos
    let yPos: RelPos;
    let zPos: RelPos;
    let dimId: DimensionId = origin.getDimension().getDimensionId();
    if (param.x.is_relative == true) {
        xPos = new RelPos(cmdPos.x + param.x.value)
    } else {xPos = new RelPos(param.x.value)}
    if (param.y.is_relative == true) {
        yPos = new RelPos(cmdPos.y + param.y.value - 1.62)
    } else {yPos = new RelPos(param.y.value)}
    if (param.z.is_relative == true) {
        zPos= new RelPos(cmdPos.z + param.z.value)
    } else {zPos = new RelPos(param.z.value)}
    if (param.DimensionId !== undefined) {
        dimId = param.DimensionId
    }
    for (const actor of param.playerName.newResults(origin)) {
        let playerName = actor.getName();
        warpAdd(playerName, param.warpName, xPos, yPos, param.z, param.DimensionId)}
},{playerName: ActorWildcardCommandSelector, warpName: CxxString, x: RelativeFloat, y: RelativeFloat, z: RelativeFloat, DimensionId: [int32_t, true]})

// /sethome
command.register('sethome', `§eSet§7 your ${homename}§r§o§7 Warp Point.`, perms.setHome).overload((_param, origin, _output)=>{
    if (origin.getName() != undefined && origin.getName() != '!Â§r') {
        let playerNetID: NetworkIdentifier = connectionList.nXNet.get(origin.getName());
        let playerActor: Player = playerNetID.getActor() as Player;
        if (playerActor != null) {
            let cmdPos: Vec3 = playerActor.getPosition()
            let dimId = playerActor.getDimensionId()
            warpAdd(playerActor.getName(), homename, new RelPos(cmdPos.x), new RelPos(cmdPos.y), new RelPos(cmdPos.z), dimId)
        }
        return 0
    }
    return 0

},{});

// /home
command.register('home', `§aWarp§7 to your ${homename}§r§o§7 Warp Point.`, perms.home).overload((_param, origin, _output)=>{
    if (origin.getName() != undefined && origin.getName() != '!Â§r') {
        let playerNetID: NetworkIdentifier = connectionList.nXNet.get(origin.getName());
        let playerActor: Player = playerNetID.getActor() as Player;
        if (playerActor != null) {
            warpTo(playerActor.getName(), homename);
        }
        return 0
    }
    return 0

},{});

// Functions

function tellRaw(playerName: string, text: string){
    system.executeCommand(`/tellraw ${playerName} {"rawtext":[{"text":"${text}"}]}`, () => {});
}
function warpMsg(playerActor: Player, text: string){
    let playerName = playerActor.getName()
    if (playerName != undefined) {
        tellRaw(playerName, '§e§l[WARP LIST]');
        tellRaw(playerName, text);
        tellRaw(playerName, '§e§l* * * * * * *');
    } else {console.log('[WARP LIST] Error: No Player Name for warpMsg()') }
}


function saveToFile(dbObject: object = warpDB, file: string = dbFile){
    let filedata = JSON.stringify(dbObject, null, 2);
    fs.writeFile(file, filedata, () => {
        console.log('[WARP LIST] Database ' + dbFile + ' SAVED');
    });
}

function warpAdd(playerName: string, warpName: string, x: RelPos, y: RelPos, z: RelPos, dimensionId?: DimensionId,){
    let originActor: Player = connectionList.nXNet.get(playerName).getActor() as Player;
    let playerObj = originActor?.getPlayerDB();
    let originXuid = connectionList.nXXid.get(playerName);
    let xPos: number;
    let yPos: number;
    let zPos: number;
    let dimId: number;

    if (x.is_relative == true) {
        xPos = originActor.getPosition().x + x.value
    } else {xPos = x.value}
    if (y.is_relative == true) {
        yPos = originActor.getPosition().y + y.value - 1.62
    } else {yPos = y.value}
    if (z.is_relative == true) {
        zPos= originActor.getPosition().z + z.value
    } else {zPos= z.value}

    if (dimensionId != undefined && dimensionId >= 0 && dimensionId <= 2) {
        dimId = parseInt(dimensionId.toFixed(0))
    } else { dimId = originActor.getDimensionId()}

    let warpEntry = new WarpDBEntry(warpName, dimId, xPos, yPos, zPos);

    if (warpName != undefined && warpName != '' && warpName != null ) {
        tellRaw(playerName, '§e§l[WARP LIST]');
        if (playerObj?.playerDB != undefined){
            let playerIndex = playerObj.index;
            let warpObject = playerObj.playerDB.getWarp(warpName)

            if (warpObject?.warp != undefined){
                tellRaw(playerName, `§eExisting §3§o${warpObject.warp.name}§r§e\n    [§f${DimensionId[warpObject.warp.dimId]} §e@ §4${warpObject.warp.x.toFixed(1)} §a${warpObject.warp.y.toFixed(1)} §9${warpObject.warp.z.toFixed(1)}§e]`);
                tellRaw(playerName, `§cOverwriting §3§o${warpName}§r§e\n    [§f${DimensionId[dimId]} §e@ §4${xPos.toFixed(1)} §a${yPos.toFixed(1)} §9${zPos.toFixed(1)}§e]`);
                let warpIndex = warpDB[playerIndex].warp.indexOf(warpObject);
                warpDB[playerIndex].warp[warpIndex] = warpEntry;

            } else {
                tellRaw(playerName, `§eSet §3§o${warpName}§r§e\n    [§f${DimensionId[dimId]} §e@ §4${xPos.toFixed(1)} §a${yPos.toFixed(1)} §9${zPos.toFixed(1)}§e]`);
                if (warpName == homename){
                    warpDB[playerIndex].warp.unshift(warpEntry);
                } else {
                warpDB[playerIndex].warp.push(warpEntry);
                }
            }

        } else {
            tellRaw(playerName, `§eSet §3§o${warpName}§r§e\n    [§f${DimensionId[dimId]} §e@ §4${xPos.toFixed(1)} §a${yPos.toFixed(1)} §9${zPos.toFixed(1)}§e]`);
            warpDB.push(new PlayerDBEntry(originXuid, playerName, warpEntry));
        }
        tellRaw(playerName, '§e§l* * * * * * *');
        // Save warpDB to dbFile
        saveToFile();
    }
}

function warpEdit(playerName: string, warpName: string, newWarpName: string = warpName, newListIndex?: number, formConfirm?: boolean){
    let originXuid = connectionList.nXXid.get(playerName);
    let dbObject = warpDB.find((obj: { xuid: string; }) => obj.xuid == originXuid);
    let dbIndex: number = warpDB.indexOf(dbObject);
    let warpObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);
    let warpIndex: number = warpDB[dbIndex].warp.indexOf(warpObject);
    let newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == newWarpName);

    if (warpName != undefined && warpName != '' && warpName != null ) {
        if (dbObject != undefined){
            if (warpObject != undefined){
                if (formConfirm == true){
                    let originNetID = connectionList.nXNet.get(playerName)
                    let delConfirmForm = new ModalForm('§0§l! - ! - ! - [WARP LIST] - ! - ! - !', `Are you sure you want to §9§lEDIT§r:\n\n§3§o${warpName}§r ?`);
                    delConfirmForm.setButtonCancel("§lCANCEL");
                    delConfirmForm.setButtonConfirm("§9§lEDIT");
                    delConfirmForm.sendTo(originNetID, (data, originNetID)=>{
                        if (data.response !== undefined && data.response !== null && data.response !== false){
                            tellRaw(playerName, '§e§l[WARP LIST]');
                            if (newWarpName && newWarpName != '' && newWarpName != null && warpName != newWarpName){
                                if (warpName != newWarpName && (warpName == homename || newWarpName == homename)) {
                                    newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);
                                    tellRaw(playerName, `§eCan't rename §3§o${homename}`);
                                }
                                else if (warpName != newWarpName && newWarpNameObject != undefined) {
                                    newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);
                                    tellRaw(playerName, `§eExisting §3§o${newWarpName}`);
                                } else {
                                    warpDB[dbIndex].warp[warpIndex].name = newWarpName;
                                    newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == newWarpName);
                                    tellRaw(playerName, `§3§o${warpName}§r§e now\n    §r§3§o${newWarpName}`);
                                }
                            }
                            if (newListIndex != undefined && newListIndex != null) {
                                if (newListIndex != warpIndex) {
                                    if(newListIndex < warpIndex) {
                                        warpDB[dbIndex].warp.splice(warpIndex, 1);
                                        warpDB[dbIndex].warp.splice(newListIndex, 0, newWarpNameObject);
                                        tellRaw(playerName, `§3§o${warpDB[dbIndex].warp[newListIndex].name} §e@ position:\n    ${newListIndex + 1}`);
                                    } else if (newListIndex > warpIndex) {
                                        warpDB[dbIndex].warp.splice(newListIndex + 1, 0, newWarpNameObject);
                                        warpDB[dbIndex].warp.splice(warpIndex, 1);
                                        tellRaw(playerName, `§3§o${warpDB[dbIndex].warp[newListIndex].name} §e@ position:\n    ${newListIndex + 1}`);
                                    }
                                } else {
                                    tellRaw(playerName, `§3§o${warpDB[dbIndex].warp[newListIndex].name} §e@ position:\n    ${newListIndex + 1}`);
                                }
                            }
                            tellRaw(playerName, '§e§l* * * * * * *');
                            saveToFile();
                        }
                    });
                } else if (formConfirm == false) {
                    tellRaw(playerName, '§e§l[WARP LIST]');
                    if (newWarpName && newWarpName != '' && newWarpName != null && warpName != newWarpName){
                        if (warpName != newWarpName && (warpName == homename || newWarpName == homename)) {
                            newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);
                            tellRaw(playerName, `§eCan't rename §3§o${homename}`);
                        }
                        else if (warpName != newWarpName && newWarpNameObject != undefined) {
                            newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);
                            tellRaw(playerName, `§eExisting §3§o${newWarpName}`);
                        } else {
                            warpDB[dbIndex].warp[warpIndex].name = newWarpName;
                            newWarpNameObject = dbObject.warp.find((obj: { name: string; }) => obj.name == newWarpName);
                            tellRaw(playerName, `§3§o${warpName}§r§e now\n    §r§3§o${newWarpName}`);
                        }
                    }
                    if (newListIndex != undefined && newListIndex != null) {
                        if (newListIndex != warpIndex) {
                            if(newListIndex < warpIndex) {
                                warpDB[dbIndex].warp.splice(warpIndex, 1);
                                warpDB[dbIndex].warp.splice(newListIndex, 0, newWarpNameObject);
                                tellRaw(playerName, `§3§o${warpDB[dbIndex].warp[newListIndex].name} §e@ position:\n    ${newListIndex + 1}`);
                            } else if (newListIndex > warpIndex) {
                                warpDB[dbIndex].warp.splice(newListIndex + 1, 0, newWarpNameObject);
                                warpDB[dbIndex].warp.splice(warpIndex, 1);
                                tellRaw(playerName, `§3§o${warpDB[dbIndex].warp[newListIndex].name} §e@ position:\n    ${newListIndex + 1}`);
                            }
                        } else {
                            tellRaw(playerName, `§3§o${warpDB[dbIndex].warp[newListIndex].name} §e@ position:\n    ${newListIndex + 1}`);
                        }
                    }
                    tellRaw(playerName, '§e§l* * * * * * *');
                    saveToFile();
                }
            } else {
                tellRaw(playerName, '§e§l[WARP LIST]');
                tellRaw(playerName, `§eNo warp called: §3§o${warpName}`);
                tellRaw(playerName, '§e§l* * * * * * *');
            }

        } else {
            tellRaw(playerName, '§e§l[WARP LIST]');
            tellRaw(playerName, '§c0 §gWarp points set');
            tellRaw(playerName, '§e§l* * * * * * *');
        }
    }
}

function warpDel(playerName: string, warpName: string, formConfirm?: boolean){
    let originXuid = connectionList.nXXid.get(playerName);
    let dbObject = warpDB.find((obj: { xuid: string; }) => obj.xuid == originXuid);
    let dbIndex: number = warpDB.indexOf(dbObject);
    let warpObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);
    let warpIndex: number = warpDB[dbIndex].warp.indexOf(warpObject);

    if (warpName != undefined && warpName != '' && warpName != null ) {
        if (dbObject != undefined){
            if (warpObject != undefined){
                if (formConfirm == true){
                    let originNetID = connectionList.nXNet.get(playerName)
                    let delConfirmForm = new ModalForm('§0§l! - ! - ! - [WARP LIST] - ! - ! - !', `Are you sure you want to §c§lDELETE§r:\n\n§3§o${warpName}§r \u203D\u203D\u203D`);
                    delConfirmForm.setButtonCancel("§lCANCEL");
                    delConfirmForm.setButtonConfirm("§c§lDELETE");
                    delConfirmForm.sendTo(originNetID, (data, originNetID)=>{
                        if (data.response !== undefined && data.response !== null && data.response !== false){
                            console.log(data.response);
                            warpDB[dbIndex].warp.splice(warpIndex, 1);
                            tellRaw(playerName, '§e§l[WARP LIST]');
                            tellRaw(playerName, `§eDeleted §3§o${warpObject.name}§r§e\n    [§f${DimensionId[warpObject.dimId]} §e@ §4${warpObject.x.toFixed(1)} §a${warpObject.y.toFixed(1)} §9${warpObject.z.toFixed(1)}§e]`);
                            tellRaw(playerName, '§e§l* * * * * * *');
                            saveToFile();
                        }
                    });
                } else {
                    warpDB[dbIndex].warp.splice(warpIndex, 1);
                    tellRaw(playerName, '§e§l[WARP LIST]');
                    tellRaw(playerName, `§eDeleted §3§o${warpObject.name}§r§e\n    [§f${DimensionId[warpObject.dimId]} §e@ §4${warpObject.x.toFixed(1)} §a${warpObject.y.toFixed(1)} §9${warpObject.z.toFixed(1)}§e]`);
                    tellRaw(playerName, '§e§l* * * * * * *');
                    saveToFile();
                }
            } else {
                tellRaw(playerName, '§e§l[WARP LIST]');
                tellRaw(playerName, `§eNo warp called: §3§o${warpName}`);
                tellRaw(playerName, '§e§l* * * * * * *');
            }

        } else {
            tellRaw(playerName, '§e§l[WARP LIST]');
            tellRaw(playerName, '§c0 §gWarp points set');
            tellRaw(playerName, '§e§l* * * * * * *');
        }
    }
}

function warpTo(playerName: string, warpName: string){
    let originXuid = connectionList.nXXid.get(playerName);
    let originActor: ServerPlayer | null = connectionList.nXNet.get(playerName).getActor();
    let dbObject = warpDB.find((obj: { xuid: string; }) => obj.xuid == originXuid);

    if (warpName != undefined && warpName != '' && warpName != null ) {
        tellRaw(playerName, '§e§l[WARP LIST]');
        if (dbObject != undefined){
            let warpObject = dbObject.warp.find((obj: { name: string; }) => obj.name == warpName);

            if (warpObject != undefined){
                if (originActor){
                    tdTeleport(originActor, {value: warpObject.x}, {value: warpObject.y}, {value: warpObject.z}, warpObject.dimId);
                    tellRaw(playerName, `§eWarped to §3§o${warpObject.name}§r§e\n    [§f${DimensionId[warpObject.dimId]} §e@ §4${warpObject.x.toFixed(1)} §a${warpObject.y.toFixed(1)} §9${warpObject.z.toFixed(1)}§e]`);
                } else {
                    tellRaw(playerName, `§cNO ACTOR FOR §3${playerName}`)
                }
            } else {
                tellRaw(playerName, `§eNo warp called: §3§o${warpName}`);
            }

        } else {
            tellRaw(playerName, '§c0 §gWarp points set');
        }
        tellRaw(playerName, '§e§l* * * * * * *');
    }
}

function warpList(playerActor: Player){
    let playerName = playerActor.getName();
    let dbObject = playerActor.getPlayerDB()?.playerDB;

    tellRaw(playerName, '§e§l[WARP LIST]');
    if (dbObject != undefined){
        if (dbObject.warp.length > 0){
            for (let i = 0; i < dbObject.warp.length; i++) {
                tellRaw(playerName , `§e[${i + 1}] §3§o${dbObject.warp[i].name}§r§e\n    [§f${DimensionId[dbObject.warp[i].dimId]} §e@ §4${dbObject.warp[i].x.toFixed(1)} §a${dbObject.warp[i].y.toFixed(1)} §9${dbObject.warp[i].z.toFixed(1)}§e]`);
            }

        } else {
            tellRaw(playerName, '§c0 §gWarp points set');
        }

    } else {
        tellRaw(playerName, '§c0 §gWarp points set');
    }
    tellRaw(playerName, '§e§l* * * * * * *');
}

function warpItemForm(playerName: string, warpIndex: number) {
    let playerXuid = connectionList.nXXid.get(playerName);
    let playerNetID = connectionList.nXNet.get(playerName);
    let dbObject = warpDB.find((obj: { xuid: string; }) => obj.xuid == playerXuid);
    if (dbObject.warp[warpIndex]) {
        let indexArray: string[] = [];
        for (let i = 0; i < dbObject.warp.length; i++){
            indexArray.push(`${i + 1}`)
        }
        let warpItemForm = new CustomForm('§0§l[WARP LIST]');
        warpItemForm.addComponent(new FormInput("§7§oName:", `${dbObject.warp[warpIndex].name}`, `${dbObject.warp[warpIndex].name}`));
        warpItemForm.addComponent(new FormDropdown("§7§oList Position:", indexArray, warpIndex));
        warpItemForm.addComponent(new FormStepSlider("§7§oAction",["§r§a§lWARP", "§r§9§lEDIT", "§r§c§lDELETE"], 0));
        warpItemForm.sendTo(playerNetID, (data, playerNetID) => {
            if (data.response !== undefined && data.response !== null){
                console.log(data.response);
                if (data.response[2] == 0) {
                    warpTo(playerName, dbObject.warp[warpIndex].name);
                }
                if (data.response[2] == 1) {
                    warpEdit(playerName, dbObject.warp[warpIndex].name, data.response[0], data.response[1], true)
                }
                if (data.response[2] == 2) {
                    warpDel(playerName, dbObject.warp[warpIndex].name, true);
                }
            }
        })
    }

}


function warpListForm(playerName: string) {
    let playerXuid = connectionList.nXXid.get(playerName);
    let playerNetID = connectionList.nXNet.get(playerName);
    let dbObject = warpDB.find((obj: { xuid: string; }) => obj.xuid == playerXuid);
    let warpListForm = new SimpleForm('§0§l[WARP LIST]')

    if (dbObject != undefined) {
        if (dbObject.warp.length >= 0) {
            for (let i = 0; i < dbObject.warp.length; i++) {
                warpListForm.addButton(new FormButton(`§1§o${dbObject.warp[i].name}§r§8\n[§0${DimensionId[dbObject.warp[i].dimId]} §8@ §4${dbObject.warp[i].x.toFixed(1)} §2${dbObject.warp[i].y.toFixed(1)} §9${dbObject.warp[i].z.toFixed(1)}§8]`));
            }
            warpListForm.sendTo(playerNetID, (data, playerNetID) => {
                if (data.response !== undefined && data.response !== null){
                warpItemForm(playerName, data.response);
                }
            })
        } else {
            tellRaw(playerName, '§e§l[WARP LIST]');
            tellRaw(playerName, '§c0 §gWarp points set');
            tellRaw(playerName, '§e§l* * * * * * *');
        }

    } else {
        tellRaw(playerName, '§e§l[WARP LIST]');
        tellRaw(playerName, '§c0 §gWarp points set');
        tellRaw(playerName, '§e§l* * * * * * *');
    }
}

// Database Entry Classes
Player.prototype.getPlayerDB = function() {
    let playerName = this.getName()
    let playerXuid = connectionList.nXXid.get(playerName);
    let dbObj: PlayerDBEntry = warpDB.find((obj: {xuid: string; }) => obj.xuid == playerXuid);
    let dbInd: number = warpDB.indexOf(dbObj);
    if (dbObj != undefined && dbInd != undefined) {
        return {
            playerDB: dbObj,
            index: dbInd
        }
    } else {return undefined}
}

class PlayerDBEntry {
    xuid: string;
    name: string;
    warp: WarpDBEntry;
    constructor(xuid: string, name: string, warp?: WarpDBEntry ){
        this.xuid = xuid;
        this.name = name;
        this.warp = [];
        if (warp != undefined){this.warp.push(warp)}
    }
    public getWarp(name: string){
        let warpObj: WarpDBEntry = this.warp.find((obj: { name: string; }) => obj.name == name);
        let warpInd: number = this.warp.indexOf(warpObj)
        if (warpObj != undefined && warpInd != undefined) {
            return {
                warp: warpObj,
                index: warpInd
            }
        } else {return undefined}
    }
}

class WarpDBEntry {
    [key: string]: any
    constructor(warpName: string, dimensionId: DimensionId, xPos: number, yPos: number, zPos: number){
        this.name = warpName;
        this.dimId = dimensionId;
        this.x = xPos;
        this.y = yPos;
        this.z = zPos;
    }
}
