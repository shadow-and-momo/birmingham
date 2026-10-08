/* Board and rules data: towns and building spaces, merchants, connections,
   industry tiles (checked against the player mat) and markets. Most rule corrections happen here. */
const TOWNS={
 stoke:{n:'Stoke-on-Trent',x:150,y:46,slots:[['cotton','goods'],['pottery','iron'],['goods']]},
 leek:{n:'Leek',x:258,y:40,slots:[['cotton','goods'],['cotton','coal']]},
 belper:{n:'Belper',x:345,y:72,slots:[['cotton','goods'],['coal'],['pottery']]},
 stone:{n:'Stone',x:88,y:122,slots:[['cotton','brewery'],['goods','coal']]},
 uttoxeter:{n:'Uttoxeter',x:200,y:126,slots:[['goods','brewery'],['cotton','brewery']]},
 derby:{n:'Derby',x:302,y:160,slots:[['cotton','brewery'],['cotton','goods'],['iron']]},
 stafford:{n:'Stafford',x:132,y:196,slots:[['goods','brewery'],['pottery']]},
 farmA:{n:'North farm brewery',lbl:'Farm brewery',x:62,y:250,farm:1,slots:[['brewery']]},
 cannock:{n:'Cannock',x:200,y:242,slots:[['goods','coal'],['coal']]},
 burton:{n:'Burton-on-Trent',x:305,y:240,slots:[['goods','coal'],['brewery']]},
 coalbrook:{n:'Coalbrookdale',x:48,y:318,slots:[['iron','brewery'],['iron'],['coal']]},
 wolves:{n:'Wolverhampton',x:145,y:322,slots:[['goods'],['goods','coal']]},
 walsall:{n:'Walsall',x:232,y:318,slots:[['iron','goods'],['goods','brewery']]},
 tamworth:{n:'Tamworth',x:328,y:318,slots:[['cotton','coal'],['cotton','coal']]},
 dudley:{n:'Dudley',x:118,y:398,slots:[['coal'],['iron']]},
 bham:{n:'Birmingham',x:228,y:402,slots:[['cotton','goods'],['goods'],['iron'],['goods']]},
 nuneaton:{n:'Nuneaton',x:340,y:396,slots:[['goods','brewery'],['cotton','coal']]},
 kidder:{n:'Kidderminster',x:72,y:470,slots:[['cotton','coal'],['cotton']]},
 redditch:{n:'Redditch',x:205,y:482,slots:[['goods','coal'],['iron']]},
 coventry:{n:'Coventry',x:332,y:472,slots:[['pottery'],['goods','coal'],['iron','goods']]},
 farmB:{n:'South farm brewery',lbl:'Farm brewery',x:42,y:540,farm:1,slots:[['brewery']]},
 worcester:{n:'Worcester',x:118,y:540,slots:[['cotton'],['cotton']]}
};
const MERCH={
 warrington:{n:'Warrington',x:42,y:54,accepts:['cotton','goods'],beer:2,bonus:{type:'money',v:5}},
 nottingham:{n:'Nottingham',x:376,y:272,accepts:['cotton','goods','pottery'],beer:2,bonus:{type:'vp',v:3}},
 shrewsbury:{n:'Shrewsbury',x:30,y:400,accepts:['cotton','pottery'],beer:1,bonus:{type:'vp',v:4}},
 gloucester:{n:'Gloucester',x:205,y:560,accepts:['cotton','goods'],beer:2,bonus:{type:'develop',v:1}},
 oxford:{n:'Oxford',x:325,y:555,accepts:['goods','pottery'],beer:2,bonus:{type:'income',v:2}}
};
const LINKS=[['warrington','stoke',1,1],['stoke','leek',1,1],['stoke','stone',1,1],['leek','belper',0,1],['belper','derby',1,1],['derby','nottingham',1,1],['derby','uttoxeter',0,1],['derby','burton',1,1],['stone','uttoxeter',0,1],['stone','stafford',1,1],['stone','burton',1,1],['stafford','cannock',1,1],['cannock','farmA',1,1],['cannock','wolves',1,1],['cannock','walsall',1,1],['cannock','burton',0,1],['burton','tamworth',1,1],['burton','walsall',1,0],['tamworth','bham',1,1],['tamworth','nuneaton',1,1],['tamworth','walsall',0,1],['walsall','wolves',1,1],['walsall','bham',1,1],['wolves','coalbrook',1,1],['wolves','dudley',1,1],['coalbrook','shrewsbury',1,1],['coalbrook','kidder',1,1],['kidder','dudley',1,1],['kidder','worcester',1,1],['worcester','gloucester',1,1],['worcester','bham',1,1],['gloucester','redditch',1,1],['redditch','bham',1,1],['redditch','oxford',1,1],['bham','oxford',1,1],['bham','coventry',1,1],['bham','nuneaton',0,1],['bham','dudley',1,1],['nuneaton','coventry',0,1]].map((l,i)=>({id:i,a:l[0],b:l[1],canal:!!l[2],rail:!!l[3]}));
const IND={coal:{name:'Coal mine',ab:'Co'},iron:{name:'Ironworks',ab:'Ir'},brewery:{name:'Brewery',ab:'Br'},cotton:{name:'Cotton mill',ab:'Ct'},goods:{name:'Manufacturer',ab:'Mf'},pottery:{name:'Pottery',ab:'Po'}};
const SELLABLE=['cotton','goods','pottery'];
const TILES={
 coal:[{l:1,n:1,cost:5,prod:2,vp:1,inc:4,lk:2,canal:1},{l:2,n:2,cost:7,prod:3,vp:2,inc:7,lk:1},{l:3,n:2,cost:8,iron:1,prod:4,vp:3,inc:6,lk:1},{l:4,n:2,cost:10,iron:1,prod:5,vp:4,inc:5,lk:1}],
 iron:[{l:1,n:1,cost:5,coal:1,prod:4,vp:3,inc:3,lk:1,canal:1},{l:2,n:1,cost:7,coal:1,prod:4,vp:5,inc:3,lk:1},{l:3,n:1,cost:9,coal:1,prod:5,vp:7,inc:2,lk:1},{l:4,n:1,cost:12,coal:1,prod:6,vp:9,inc:1,lk:1}],
 brewery:[{l:1,n:2,cost:5,iron:1,vp:4,inc:4,lk:2,canal:1},{l:2,n:2,cost:7,iron:1,vp:5,inc:5,lk:2},{l:3,n:2,cost:9,iron:1,vp:7,inc:5,lk:2},{l:4,n:1,cost:9,iron:1,vp:10,inc:5,lk:2,rail:1}],
 cotton:[{l:1,n:3,cost:12,beer:1,vp:5,inc:5,lk:1,canal:1},{l:2,n:2,cost:14,coal:1,beer:1,vp:5,inc:4,lk:2},{l:3,n:3,cost:16,coal:1,iron:1,beer:1,vp:9,inc:3,lk:1},{l:4,n:3,cost:18,coal:1,iron:1,beer:1,vp:12,inc:2,lk:1}],
 goods:[{l:1,n:1,cost:8,coal:1,beer:1,vp:3,inc:5,lk:2,canal:1},{l:2,n:2,cost:10,iron:1,beer:1,vp:5,inc:1,lk:1},{l:3,n:1,cost:12,coal:2,beer:0,vp:4,inc:4,lk:0},{l:4,n:1,cost:8,iron:1,beer:1,vp:3,inc:6,lk:1},{l:5,n:2,cost:16,coal:1,beer:2,vp:8,inc:2,lk:2},{l:6,n:1,cost:20,beer:1,vp:7,inc:6,lk:1},{l:7,n:1,cost:16,coal:1,iron:1,beer:0,vp:9,inc:4,lk:0},{l:8,n:2,cost:20,iron:2,beer:1,vp:11,inc:1,lk:1}],
 pottery:[{l:1,n:1,cost:17,iron:1,beer:1,vp:10,inc:5,lk:1,bulb:1},{l:2,n:1,cost:0,coal:1,beer:1,vp:1,inc:1,lk:1},{l:3,n:1,cost:22,coal:2,beer:2,vp:11,inc:5,lk:1,bulb:1},{l:4,n:1,cost:0,coal:1,beer:1,vp:1,inc:1,lk:1},{l:5,n:1,cost:24,coal:2,beer:2,vp:20,inc:5,lk:1,rail:1}]
};
const PRICES={coal:[1,1,2,2,3,3,4,4,5,5,6,6,7,7],iron:[1,1,2,2,3,3,4,4,5,5]};
const FALL={coal:8,iron:6};
const HAND=8;
// Official card distribution by player count [2p, 3p, 4p].
const DECK_TOWNS={belper:[0,0,2],derby:[0,0,3],leek:[0,2,2],stoke:[0,3,3],stone:[0,2,2],uttoxeter:[0,1,2],stafford:[2,2,2],burton:[2,2,2],cannock:[2,2,2],tamworth:[1,1,1],walsall:[1,1,1],coalbrook:[3,3,3],dudley:[2,2,2],kidder:[2,2,2],wolves:[2,2,2],worcester:[2,2,2],bham:[3,3,3],coventry:[3,3,3],nuneaton:[1,1,1],redditch:[1,1,1]};
const DECK_INDS={iron:[4,4,4],coal:[2,2,3],cg:[0,6,8],pottery:[2,2,3],brewery:[5,5,5]};
