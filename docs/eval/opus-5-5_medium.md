# Evaluation run

Model: `claude-opus-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.30.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `resolve_airports({"query":"New England"})`, `rank_airports({"region":"New England","top_n":10})`  
**Model calls:** 2 | **Tokens:** in 6, out 1536, cache-read 6900 | **Est. cost:** $0.064  
**Grounding:** 51/52 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> Boston Logan (BOS) is the strongest New England candidate by a clear margin, scoring 72.2 and ranking 11th nationally. Portland, Maine (PWM) comes second at 65.1. Bangor (BGR) and Burlington (BTV) both score 63.2 and are effectively tied for third. Bradley (BDL) is fifth at 58.2.
> 
> **Why they rank where they do** (12 months to July 2026)
> 
> - **BOS (72.2):** It is the largest airport in the region, with 20.9M passengers [T-100], and the FAA expects it to add 5.6M enplanements by 2035 [TAF], which is in the 93rd percentile nationally. It is also congested: in the slowest 10% of departures, taxi-out took 35.0 minutes or more (93rd percentile), and 27.9% of departures were delayed 15+ minutes [On-Time Performance]. The weak spot is recent traffic: passengers fell 2.3% year on year. So the case rests on the forecast and on current congestion, not on recent growth.
> - **PWM (65.1):** Planes are full for an airport its size. The busiest month's load factor (share of seats filled) was 88.9% (93rd percentile), and the 12-month average was 81.7%. It is much smaller than Boston, at 1.3M passengers.
> - **BGR (63.2):** It ranks mainly on growth: passengers rose 17.5% (99th percentile). It is small (477k passengers), so the size score is low.
> - **BTV (63.2):** It has the strongest demand pressure in the region. Passengers grew 3.8 points faster than seats (97th percentile), and the slowest 10% of departures took 36.4 minutes or more to taxi out. But passengers fell 1.8%.
> - **BDL (58.2):** Planes are full (81.4% load factor), but it has the weakest growth outlook of the five. Passengers fell 4.3%, and the FAA's 10-year forecast is 1.5% a year.
> 
> Below these, PVD scores 52.1, HVN 49.2 and MHT 41.9. HVN's score has low confidence because it has no on-time data, so congestion was left out and the score was re-weighted over the other parts. MHT's planes are relatively empty, with a 74.9% load factor (17th percentile).
> 
> **Assumptions and limits**
> - **Default weights:** demand pressure 30%, congestion 25%, growth 25%, size 20%. The order of the top five stays the same when each weight moves by ±20%, except that BGR and BTV swap places.
> - **Congestion is based on one month of on-time data, July 2025.** That is a summer peak, and it falls before the 12-month passenger window, so it may overstate congestion across the year. This matters most for the smaller Maine and Vermont airports, which may be seasonal.
> - **Taxi-out times and delays are proxies.** They may reflect runway or airspace limits, not the terminal. At BOS, 31.4% of delay minutes are attributed to the air traffic system (95th percentile), so the terminal may not be the bottleneck. Check this before reading the score as a terminal case.
> - **Coverage:** Only 8 of the region's 73 airports with service were scored. Airports with fewer than 300,000 passengers a year were not scored, including ACK, ORH, MVY and PSM. Being left off the list does not mean they scored low.
> - **What the score is not:** It is a screen for where extra capacity would be used. It does not model costs or returns, and it is not a recommendation to invest.
> 
> If you'd like a closer look at any of these, I can check unmet-demand proxies for BOS, PWM or BTV, or compare BGR and BTV directly.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1484, cache-read 9827 | **Est. cost:** $0.038  
**Grounding:** 44/50 figures traced to tool output; untraced: 1.9, 5.5, 0.3, 7.8

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> Portland (PWM) ranks above Bangor (BGR) because it is larger and its planes are fuller, and that outweighs Bangor's much faster recent growth. The overall gap is small, 1.9 points (65.1 vs 63.2). I've taken "Portland" to mean Portland, Maine (PWM), from the earlier ranking.
> 
> **Where the 1.9 points come from** (derived from the component points in the earlier result)
> 
> | Component (weight) | PWM | BGR | Difference |
> |---|---|---|---|
> | Size of prize (20%) | 9.4 | 3.9 | **+5.5 PWM** |
> | Demand pressure (30%) | 24.0 | 20.1 | **+3.9 PWM** |
> | Congestion (25%) | 19.5 | 19.2 | +0.3 PWM |
> | Growth outlook (25%) | 12.2 | 20.0 | **−7.8 BGR** |
> 
> - **Size helps Portland.** PWM had 1.3M passengers over 12 months, against 477k at BGR [T-100]. The FAA also expects PWM to add more passengers by 2035: 278k vs 103k [TAF].
> - **Fuller planes help Portland.** PWM's planes were 81.7% full on average (84th percentile nationally), against 79.7% at BGR (60th). In the busiest month, PWM was 88.9% full (93rd percentile) and BGR 87.2% (79th).
> - **Congestion is about even.** Bangor looks worse on two measures. In the slowest 10% of departures, taxi-out took 31.0 minutes or more at BGR vs 27.0 at PWM. And 45.0% of BGR's delay minutes come from the air traffic system, vs 26.5%. Portland looks worse on the third: 28.7% of its departures were delayed 15+ minutes, vs 25.0%. These roughly cancel out.
> - **Growth is Bangor's strength, but not enough.** BGR's passengers grew 17.5% year on year (99th percentile), against 0.7% at PWM. That one factor is worth 7.8 points to Bangor, but it doesn't make up for the 9.4 points Portland gains on size and demand.
> 
> **Assumptions and limits**
> - **The order holds within the tested range.** When each weight moved ±20%, PWM stayed 2nd every time and BGR stayed between 3rd and 4th. Putting much more weight on growth, beyond that range, could flip the order. I can re-run the ranking with weights you choose.
> - **Bangor's growth is a single year-on-year figure.** It may reflect new routes and might not last. Its FAA 10-year forecast (2.2% a year) is close to Portland's (2.0%).
> - **Congestion figures come from one month, July 2025.** Both airports may be seasonal, so these numbers may not represent the whole year.
> - **What the scores are not:** They are a screen, not a valuation. They don't show whether the terminal, rather than the runway or airspace, is what limits either airport.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","top_n":10,"weights":{"demand_pressure":0.3,"congestion":0.1,"growth":0.4,"scale":0.2}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1623, cache-read 23836 | **Est. cost:** $0.075  
**Grounding:** 43/46 figures traced to tool output; untraced: 7.1, 2.8, 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> If growth counts much more than congestion, Bangor (BGR) moves up to second, overtaking Portland (PWM), and comes close to Boston (BOS). Boston stays first, but its lead shrinks from 7.1 points to 2.8, and in the stability test the two swap places. They are effectively tied for first.
> 
> **What I changed:** I raised growth from 25% to 40% of the score and cut congestion from 25% to 10%. Demand pressure (30%) and size (20%) stayed the same. These weights are my choice; I can re-run with others.
> 
> **New order**
> 
> | Rank | Airport | Score now | Score before | Rank before |
> |---|---|---|---|---|
> | 1 | BOS | 66.6 | 72.2 | 1 |
> | 2 | BGR | 63.8 | 63.2 | 3–4 (tied) |
> | 3 | PWM | 60.8 | 65.1 | 2 |
> | 4 | BTV | 56.9 | 63.2 | 3–4 (tied) |
> | 5 | BDL | 50.1 | 58.2 | 5 |
> | 6 | HVN | 49.8 | 49.2 | 7 |
> | 7 | PVD | 46.0 | 52.1 | 6 |
> | 8 | MHT | 36.6 | 41.9 | 8 |
> 
> **Why it moves**
> - **Bangor gains.** Its growth score (80.1) is the highest in the region, driven by 17.5% passenger growth (99th percentile). At the higher weight, growth is now worth 32.0 points to Bangor, up from 20.0. That more than makes up for its small size (477k passengers).
> - **Boston and Portland slip.** Both have middling growth scores (46.2 and 48.9), and both lose most from congestion counting less. Boston fell from 11th to 26th nationally. Its growth case rests on the FAA forecast (5.6M added passengers by 2035), not on recent traffic, which fell 2.3%.
> - **Burlington drops clearly to fourth.** Its strengths were congestion and how fast passengers outpaced seats. Its growth is weak: passengers fell 1.8%.
> - **Bradley and New Haven are now a tie.** Bradley's passengers fell 4.3%, so its score falls to 50.1, just above New Haven's 49.8. New Haven's 3.6% passenger growth moves it ahead of Providence (PVD).
> 
> **Assumptions and limits**
> - **The ranking is less stable at these weights.** When each weight moves ±20%, BOS and BGR swap places, and BDL can drop to sixth. Treat 1–2 and 5–6 as ties. Portland at 3rd and Burlington at 4th hold firm.
> - **Bangor's lead rests on one year-on-year growth figure.** It may reflect new routes and might not last. Its FAA 10-year forecast (2.2% a year) is close to Portland's (2.0%). The more weight you put on growth, the more the ranking depends on that single number.
> - **New Haven's score is low-confidence.** It has no on-time data, so its score was calculated without congestion. That helps it more as congestion weight falls.
> - **Congestion still comes from one month, July 2025,** though it now counts for only 10%.
> - **Unchanged from before:** Only 8 airports were scored; ACK, ORH, MVY, PSM and others are below the 300,000-passenger minimum. Costs, returns and whether the terminal is the real bottleneck aren't modelled.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 1291, cache-read 11423 | **Est. cost:** $0.043  
**Grounding:** 33/35 figures traced to tool output; untraced: 10%, 90

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> Per flight, LAX and John Wayne (SNA) are about equally congested. Their taxi-out and delay figures are within about a minute or a point of each other, and each airport is slightly worse on some measures. SNA's congestion score is a bit higher (65.9 vs 56.0 out of 100), but the raw gaps are too small to call either one clearly more congested. Because LAX runs about 5 times as many passenger departures, its total delay is much larger.
> 
> **Per-flight measures (July 2025 on-time data)**
> 
> | Measure | LAX | SNA |
> |---|---|---|
> | Average taxi-out | 17.5 min | 16.4 min |
> | Slowest 10% of taxi-outs (90th percentile) | 26 min | 27 min |
> | Average departure delay | 19.0 min | 18.7 min |
> | Departures delayed 15+ min | 22.9% | 23.8% |
> | Cancelled | 1.2% | 1.4% |
> | Share of delay from air traffic control and airspace | 21.3% | 28.2% |
> 
> - **Typical flight:** LAX is about a minute worse on average taxi-out. Average delay is nearly the same.
> - **Bad days:** SNA is slightly worse on long taxi-outs, the share of flights delayed 15+ minutes, and cancellations.
> - **Cause of delay:** More of SNA's delay comes from air traffic control and airspace (28.2% vs 21.3%). That points to the airfield and airspace rather than the terminal.
> - **Scale:** In the 12 months to July 2026, LAX had 253,301 passenger departures and 36.0M departing passengers. SNA had 50,960 departures and 5.5M passengers. The 5x figure is my own division of those departure counts.
> 
> **Context for screening:** Overall, LAX scores higher than SNA (69.5 vs 61.9, ranked 17th and 43rd nationally). Most of that gap comes from size and how full its flights are, not congestion. LAX flights are 82.2% full on average (88.1% in the peak month) against 79.7% at SNA.
> 
> **Assumptions and limits**
> - **Which airport "LA" means:** I took it to mean LAX. Burbank, Long Beach and Ontario are also in the LA area but weren't included; I can add them. "LA" can also mean Louisiana, which I assumed you didn't mean.
> - **One month of data:** The congestion figures come from July 2025 only, so they may reflect summer conditions. That's a year older than the traffic data, which runs to July 2026. Both scores are flagged as medium confidence.
> - **Large airlines only:** The on-time data covers only the bigger carriers that report it: 72.7% of flights at LAX and 88.8% at SNA. Smaller airlines' delays aren't included.
> - **What these measures show:** Taxi-out and delay reflect ground and departure congestion, not terminal capacity. Congestion here doesn't by itself mean a bigger terminal would help.
> - **Scope:** This is a screening comparison. It doesn't cover costs, returns or an investment recommendation.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `resolve_airports({"query":"Anchorage"})`, `route_mix({"airport":"ANC","service":"passenger"})`, `route_mix({"airport":"ANC","service":"all"})`  
**Model calls:** 3 | **Tokens:** in 8, out 1411, cache-read 10934 | **Est. cost:** $0.049  
**Grounding:** 33/35 figures traced to tool output; untraced: 52%, 24,643

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> **Only 2.8% of passenger departures from Anchorage (ANC) are long-haul, if long-haul means a nonstop of 3,000+ miles. Those flights carry 6.1% of passengers.** If you count cargo flights too, the share jumps to 29.5%, because most of ANC's long-haul flying is cargo. This covers the 12 months from August 2025 to July 2026 [T-100].
> 
> **Why cargo changes the answer so much**
> - ANC had more all-cargo departures (47,717) than passenger departures (39,532).
> - Of 87,249 departures in total, 25,743 were 3,000+ miles. Only 1,100 of those were passenger flights. That means about 52% of cargo departures are long-haul (my own arithmetic: 24,643 of 47,717).
> - The top cargo long-haul routes are US cargo hubs like Louisville (SDF), Miami (MIA) and Memphis (MEM), plus Asian airports like Hong Kong (HKG), Seoul (ICN) and Taipei (TPE).
> - On the passenger side, ANC is mostly short and medium flights: 49.7% of departures go under 500 miles. Its main long-haul passenger route is Dallas/Fort Worth (DFW, 3,043 miles, 389 departures). Next come Atlanta, Houston and the Washington/New York airports. Only 0.7% of passenger departures are international.
> 
> **The 3,000-mile line matters a lot**
> Many of ANC's busiest long passenger routes are only just over 3,000 miles, so small changes to the definition move the result sharply:
> 
> | Long-haul threshold | Passenger departures | Passengers | All departures (incl. cargo) |
> |---|---|---|---|
> | 2,500+ mi | 9.7% | 20.9% | 41.3% |
> | 3,000+ mi | 2.8% | 6.1% | 29.5% |
> | 3,500+ mi | 0.3% | 0.4% | 16.3% |
> 
> **Assumptions and limits**
> - **Airport:** I assumed you meant Ted Stevens Anchorage International. "Anchorage" also matched Merrill Field (MRI) and Elmendorf Air Force Base (EDF), which have little or no airline traffic.
> - **Definition:** There's no official definition of long-haul. I used the tool's default: a single nonstop flight of 3,000+ statute miles. It measures each flight leg, not a passenger's whole trip, so a connecting passenger is counted on each leg.
> - **Scope:** These are departures from ANC only. The passenger figures include scheduled and charter passenger flights. Freight carried on passenger flights isn't counted as cargo flying.
> - **Investment angle:** Most of ANC's long-haul activity is cargo, so it won't tell you much about demand for passenger terminal space. I can run a demand check or a comparison with other airports if that's useful.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1039, cache-read 8878 | **Est. cost:** $0.023  
**Grounding:** 28/31 figures traced to tool output; untraced: 10%, 14.1%, 11.7%

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **Short answer:** These proxies show little sign of seat demand going unmet at SFO. In the 12 months to July 2026, flights were full above 85% in only one month, and seat supply grew slightly faster than passengers. SFO's clearer problem is congestion on the ground and in the air, which a bigger terminal may not fix.
> 
> **Why**
> 
> - **Planes are busy but rarely full.** On average 82.1% of seats were filled, which is higher than at 88% of scored US airports. Only June 2026 went above 85%, at 87.1%. To keep every month at or below 85%, SFO would have needed about 70,165 more seats. That is about 0.2% of annual seats, so the gap is small [T-100].
> - **Seats are keeping up with demand.** Passengers rose 0.6% year over year and seats rose 0.8%. If demand were being held back, you would expect passengers to grow faster than seats [T-100].
> - **Congestion is high.** For 90% of departures, the time from leaving the gate to takeoff was 33 minutes or less, so the slowest 10% took longer. That is worse than at 90% of scored airports. Also, 23.5% of departures by the airlines that report on-time data left 15+ minutes late [On-Time Performance].
> - **Some demand may already go to nearby airports, but they have room.** Planes are less full at Oakland (OAK, 11 miles away, 74.4%) and San Jose (SJC, 30 miles, 73.5%). Both are losing passengers, OAK by 14.1% and SJC by 11.7% year over year. So the region has spare seats rather than a shortage.
> - **The terminal is probably not what limits SFO.** The tool notes that SFO's parallel runways are closely spaced and fog cuts arrivals. A larger terminal may not let SFO handle more flights.
> 
> **Assumptions and limits**
> 
> - **No single number exists.** "Unmet demand" can't be measured directly, so the figures above are stand-ins. The 70,165-seat gap is one of them, not a measured count.
> - **The 85% "full" line is a rule of thumb.** I didn't run other thresholds. A lower one, such as 80%, would mark more months as full.
> - **Full planes don't prove people were turned away.** Airlines also fill planes by adjusting fares.
> - **The delay figures rest on one month.** They cover only July 2025, which falls outside the 12-month passenger window, so they may reflect one season.
> - **Not covered:** fares, denied boardings, waitlists, gate or slot limits, travellers who never booked or travelled another way, and cargo or international demand beyond what the T-100 flight data shows.
> - **This is a screen, not an investment view.** There's no cost or return modelling.
> 
> If it helps, I can rerun this at an 80% threshold or compare SFO, OAK and SJC side by side.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 393, cache-read 3447 | **Est. cost:** $0.009  
**Grounding:** 0/1 figures traced to tool output; untraced: 100,

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that. Whether to buy Delta Air Lines stock is an investment decision about a listed company. It's outside what I cover, and I don't have stock prices, airline financials or market forecasts to work from.
> 
> **What I can do** is screen US airports for terminal expansion or renovation, using public aviation data (BTS T-100, On-Time Performance, the FAA Terminal Area Forecast). If it's useful, I can:
> 
> - **Rank airports** by investment opportunity score, nationwide or within a region, for example Delta hubs such as Atlanta, Detroit, Minneapolis or Salt Lake City, if you name them.
> - **Compare airports** on scale, load factor, growth and congestion.
> - **Look at demand pressure** at one airport: how full the flights are, how fast demand is growing compared with seats, and nearby airports that could take overflow.
> - **Show the route mix**, such as the share of long-haul flights from an airport.
> 
> None of this tells you whether Delta's stock is a good buy, and the scores are a screening tool, not investment advice. Tell me which of these you'd like and I'll run it.
