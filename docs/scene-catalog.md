# Scene catalog

Each question's `explain.scene` names one animated scene template and `explain.sceneParams` sets it up.
Scenes are drawn by `app/js/scenes/*.js`. Unknown or missing scene → the app plays a **rule card**
(`rulecard`), so a question never shows a blank board.

All scenes are top-down, cars drive **up** the screen (Italy drives on the right).
"Our car" (blue, label "YOU") is the learner. Every scene ends on a verdict badge: OK (green) or NO (red).

## Common params (all scenes)
| param | values | meaning |
|---|---|---|
| `verdict` | `"ok"` / `"no"` | the badge shown at the end: is the shown action allowed/correct? |
| `caption` | short English text, max ~60 chars | final caption under the board |
| `it` | Italian key word(s), e.g. `"sorpasso"` | shown as a word chip with its meaning |

## Overtaking scenes (chapter 15)

### `overtake.basic` - a normal overtake on the left, step by step
Steps: check mirror -> indicator -> move left with side gap -> pass -> check mirror -> back to the right.
| param | values |
|---|---|
| `focus` | `"checks"` (visibility, road clear, nobody behind overtaking), `"signal"` (indicator), `"gap"` (side distance), `"return"` (return right when safe, without cutting in), `"mirror"` (check overtaken car in mirror), `"speed"` (adapt speed to the other car, speed limit still applies), `"distance"` (keep safe distance before starting) |
| `bad` | optional: `"cutIn"` (cuts in too early, other car brakes), `"stayLeft"` (stays in left lane too long), `"horn"` (honks - not required), `"noSignal"`, `"race"` (overtaken car speeds up) |

### `overtake.blocked` - overtaking is forbidden here (verdict usually "no")
| param | values |
|---|---|
| `hazard` | `"curve"`, `"hill"` (dosso, crest of a hill), `"fog"` (poor visibility), `"solidLine"`, `"doubleSolid"`, `"oncoming"`, `"levelCrossing"`, `"trafficLightQueue"`, `"queue"` (slow traffic), `"pedCrossing"` (car stopped/slowing for pedestrians), `"accelLane"` (acceleration/deceleration lane), `"ambulance"` (following behind an emergency vehicle), `"alreadyOvertaking"` (car ahead is overtaking, you would go into the opposite side), `"junction"` (unregulated junction) |
| `road` | `"twoWay"` (default: one lane each way) |

### `overtake.allowed` - overtaking is allowed even though something looks risky (verdict "ok")
| param | values |
|---|---|
| `road` | `"oneWay"` (one-way road, 2 lanes), `"dual"` (two separate carriageways, 2+ lanes each way), `"twoLanesEach"` |
| `feature` | `"curve"`, `"hill"`, `"dashedLine"`, `"mixedLine"` (dashed line on your side next to a solid one), `"junctionLights"` (junction with traffic lights), `"junctionPolice"` (officer directs traffic), `"junctionPriority"` (priority road, separate carriageways, lane markings), `"bicycle"` (passing a bicycle at a junction without crossing the centre), `"levelCrossingLights"` (unbarriered crossing with traffic lights), `"hillDownSlope"` (descending side of a crest), `"police"` (police car not on emergency), `"bus"` (bus stopped at a stop), `"rightIndicator"` (car ahead signals right / pulling over), `"secondOvertake"` (on a road with 2+ lanes each way, a second overtake without first going back right) |

### `overtake.right` - overtaking on the RIGHT
| param | values |
|---|---|
| `case` | `"leftTurner"` (car ahead signalled left turn and moved to the centre), `"oneWayLeftStop"` (one-way road, car ahead signals it will stop on the left), `"tramMoving"` (tram running in the middle of the road), `"tramOneWay"` (tram on a one-way road: both sides OK if wide enough), `"tramIsland"` (tram stopped, passenger island present: right side OK), `"tramNoIsland"` (tram stopped, no island: right side NOT OK), `"motorway"` (normally NOT allowed on motorways), `"motorbike"` (passing motorbikes on the right is NOT allowed) |

### `overtake.space` - how much road an overtake needs
| param | values |
|---|---|
| `factor` | `"speedDiff"` (small speed difference = much longer), `"lengthOther"` (long truck), `"lengthOwn"` (towing a caravan), `"otherAccelerates"` (longer), `"otherSlows"` (SHORTER, not longer) |

### `overtake.beingOvertaken` - what to do when someone overtakes YOU
| param | values |
|---|---|
| `do` | `"keepRight"`, `"noAccelerate"`, `"slowDown"` (when oncoming traffic appears), `"letPass"` (very slow vehicle stops to let traffic flow) |
| `bad` | optional: `"race"`, `"centre"` (moves to the centre), `"hazardLights"`, `"highBeam"`, `"indicator"` |

### `overtake.motorway` - overtaking on a motorway (3 lanes)
| param | values |
|---|---|
| `risk` | `"mirror"` (car coming fast behind), `"distance"`, `"cutIn"` (car ahead suddenly moves left), `"stayLeft"` (blocking the left lane), `"follow"` (following another overtaking car closely), `"wind"` (strong side wind) |

## Fallback for every chapter

### `rulecard` - the rule appears line by line with icons
| param | values |
|---|---|
| `lines` | array of 2-4 very short English lines (max ~50 chars each) |
| `icons` | array of icon ids, same length as `lines`. Ids: `car`, `truck`, `bus`, `tram`, `moto`, `bike`, `pedestrian`, `police`, `ambulance`, `eye`, `mirror`, `indicator`, `horn`, `highbeam`, `speed`, `distance`, `warning`, `check`, `cross`, `road`, `curve`, `hill`, `fog`, `rain`, `snow`, `night`, `wind`, `train`, `light`, `sign`, `book`, `money`, `points`, `alcohol`, `seatbelt`, `child`, `firstaid`, `fuel`, `leaf`, `tyre`, `brake`, `engine` |

## Sign scenes (chapters 2-10) - `sign`
Shows the question's own sign picture on a pole, then your car does what the sign means.
| param | values |
|---|---|
| `action` | `slow` (danger ahead: brake, hazard icon appears), `stop` (full stop at STOP line, cross traffic passes), `giveWay` (slow at dashed line, let the crossing car pass), `priority` (you go first, the other car waits), `noEntry`, `noOvertake`, `turnLeft`, `turnRight`, `straight` (compulsory direction), `keepRight`, `keepLeft` (pass the obstacle on that side), `noTurnLeft`, `noTurnRight`, `noUTurn`, `speedLimit` (with `value`), `endLimit`, `park`, `noParking`, `noStopping`, `info` (the sign only gives information) |
| `hazard` | optional emoji shown ahead for danger signs, e.g. "🚸" children, "🐄" animals, "🚧" works, "🌊" flooding, "🚂" level crossing, "↪️" bend, "🪨" falling rocks, "🚲" cyclists, "🦌" wild animals, "💨" side wind, "❄️" ice, "⛰️" steep hill, "🚦" traffic lights, "🚶" pedestrians, "✈️" low flying planes, "🔀" crossroads, "↔️" two-way traffic |
| `distance` | optional text, e.g. "150 m" (distance between danger sign and danger outside towns) |
| `value` | number, for `speedLimit` |
Use `verdict` "ok" when the scene shows correct behaviour. For a FALSE statement, show the CORRECT meaning of the sign (verdict "ok") and let the caption say what the statement got wrong.

## Official figure - `figure`
The question's picture big on the board, then 1-3 short lines appear under it (like a rule card).
| param | values |
|---|---|
| `lines` | 1-3 very short English lines (max ~45 characters each) |

## Road parts (chapter 1) - `roadparts`
A road drawing where one part lights up.
| param | values |
|---|---|
| `part` | `carreggiata`, `corsia`, `banchina`, `marciapiede`, `pistaCiclabile`, `spartitraffico`, `passaggioPedonale`, `intersezione`, `corsiaEmergenza` |

Choose: questions about a SIGN picture -> `sign`; questions about a road DIAGRAM picture -> `figure`; definitions without a picture -> `roadparts` when one of the parts fits, otherwise `rulecard`.
