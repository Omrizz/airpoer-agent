# Evaluation run

Model: `claude-sonnet-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.16.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England"})`  
**Model calls:** 2 | **Tokens:** in 6, out 974, cache-read 3450 | **Est. cost:** $0.034  
**Grounding:** 36/36 figures traced to tool output

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest New England candidate, scoring 72.2 and ranking 11th nationally. Portland, ME (PWM, 65.1) is second. Bangor (BGR), Burlington (BTV) and Bradley (BDL) follow.** These are screening scores, not investment recommendations.
> 
> **Top five (data to July 2026)**
> - **BOS, 72.2:** It has the largest scale in the region, at 20.9M passengers. The FAA forecasts 5.6M added enplanements by 2035 [TAF]. Its P90 taxi-out is 35.0 min. Passenger growth is weak, at -2.3% year on year.
> - **PWM, 65.1:** Its load factor is 81.7%, and its peak-month load factor is 88.9% (93rd percentile nationally). It is much smaller, at 1.3M passengers.
> - **BGR, 63.2:** Passenger growth is 17.5% year on year, but it is small at 477k passengers, so its size-of-prize score is low.
> - **BTV, 63.2:** Its P90 taxi-out is 36.4 min. Passenger growth exceeds seat growth by 3.8 points, which suggests tight capacity. Passengers fell 1.8% year on year.
> - **BDL, 58.2:** It has 3.2M passengers and a load factor of 81.4%. Passenger growth is -4.3% year on year.
> 
> PVD (52.1), HVN (49.2) and MHT (41.9) rank lower. MHT's load factor is 74.9%.
> 
> **Uncertainty**
> - BGR and BTV are effectively tied for 3rd and 4th. They swap places under ±20% weight changes.
> - The top five as a group stays stable under those changes. BOS, PWM and BDL hold their ranks.
> - Congestion rests on a single month of on-time data (July 2025, a summer peak). It may overstate year-round congestion, and this affects every airport.
> - HVN has no congestion data. Its score is re-weighted over the other components and its confidence is low.
> 
> **Assumptions and limits**
> - Default weights: demand pressure 30%, congestion 25%, growth 25%, scale 20%.
> - Percentiles are national, across 179 airports with at least 300k departing passengers a year.
> - 65 New England airports were not scored, mostly below the traffic floor. They include ACK, ORH, MVY and PSM. Not being scored does not mean they scored low.
> - Taxi-out and delay are proxies for congestion, not measures of runway capacity.
> - The screen does not model construction cost or returns. It also doesn't test whether the terminal is the binding constraint.
> 
> I can run a demand-gap check on BOS or PWM, or re-rank with different weights, for example more weight on growth.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1048, cache-read 9397 | **Est. cost:** $0.015  
**Grounding:** 33/39 figures traced to tool output; untraced: 1.9, 5.5, 0.3, 7.8

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> **Portland (PWM) edges Bangor (BGR) because of stronger demand pressure and a larger size of prize. Bangor's much higher growth score offsets most of that.** PWM scores 65.1 and BGR scores 63.2, a gap of 1.9 points (derived).
> 
> Differences in weighted points, PWM minus BGR (derived from the earlier ranking):
> - **Demand pressure: PWM +3.9** (24.0 vs 20.1 points). PWM's load factor is 81.7% against 79.7%. Its peak-month load factor is 88.9% against 87.2%.
> - **Size of prize: PWM +5.5** (9.4 vs 3.9). PWM has 1.3M passengers against 477k. Its forecast added enplanements are 278k against 103k.
> - **Congestion: PWM +0.3** (19.5 vs 19.2). This is essentially even. BGR has the longer P90 taxi-out (31.0 min vs 27.0). PWM has more departures delayed 15+ minutes (28.7% vs 25.0%).
> - **Growth: BGR +7.8** (20.0 vs 12.2). BGR's passenger growth is 17.5% year on year, against 0.7% for PWM.
> 
> The sum of those four differences is 1.9 points (derived).
> 
> **Uncertainty**
> - The ranking was stable when each weight was shifted by ±20%. PWM stayed 2nd and BGR stayed 3rd or 4th, so the order is fairly robust.
> - A 1.9-point gap is small, and BGR is tied with BTV. I would treat PWM and BGR as close, and the gap comes mostly from scale rather than from stronger congestion at PWM.
> - BGR's growth score rests on one year of 17.5% growth from a small base. Its 45.0% share of delay minutes from air-system/volume (NAS) is also the highest of the airports shown. That figure is from a single month of on-time data (July 2025), so it may not hold year-round.
> 
> **Assumptions and limits**
> - Default weights: demand pressure 30%, congestion 25%, growth 25%, scale 20%. Putting more weight on growth would narrow the gap or could reverse the order. I haven't run that case.
> - The screen doesn't model cost, returns, or whether the terminal is the binding constraint.
> 
> I can re-rank with growth weighted more heavily if you want to see where the order flips.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","weights":{"growth":0.45,"congestion":0.1,"demand_pressure":0.25,"scale":0.2}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1124, cache-read 21744 | **Est. cost:** $0.033  
**Grounding:** 35/35 figures traced to tool output

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **Weighting growth heavily moves Bangor (BGR) up to 2nd, ahead of Portland (PWM), and it nearly catches Boston.** BOS is still first, at 65.3 against BGR's 64.4. The gap is 0.9 points (derived), so I'd call them effectively tied.
> 
> I used growth 45%, congestion 10%, demand pressure 25% and scale 20%. The defaults were 25%, 25%, 30% and 20%. I chose these weights to reflect "much more growth, much less congestion". Tell me if you had other numbers in mind.
> 
> **Rank changes (new rank, with the default rank in brackets)**
> 
> | Airport | New score | New rank | Default rank |
> |---|---|---|---|
> | BOS | 65.3 | 1 | 1 |
> | BGR | 64.4 | 2 | 3 |
> | PWM | 59.2 | 3 | 2 |
> | BTV | 54.5 | 4 | 4 |
> | HVN | 49.4 | 5 | 7 |
> | BDL | 46.8 | 6 | 5 |
> | PVD | 44.4 | 7 | 6 |
> | MHT | 36.2 | 8 | 8 |
> 
> **Why the order changed**
> - **BGR gains** because its growth score is 80.1, driven by 17.5% passenger growth year on year. Growth now supplies 36.1 of its 64.4 points.
> - **PWM drops** because its growth score is only 48.9, with 0.7% passenger growth. Its strengths are load factor and peak-month load factor, which sit in demand pressure and congestion, and those components now count for less.
> - **BDL falls** below HVN, mainly because its growth score is 14.4 (passengers -4.3% year on year, 10-year forecast growth of 1.5% a year). HVN is re-weighted without congestion data, so its score is lower-confidence.
> - **BOS holds first** because its scale score is 92.2. Its growth score is only 46.2.
> 
> **Uncertainty**
> - Under ±20% weight shifts, BOS and BGR swap between 1st and 2nd. PWM stays 3rd and BTV stays 4th.
> - HVN's 5th place is the least stable. It slips to 6th in some cases, and it has low confidence because it has no congestion data.
> - BGR's growth score rests on one year of 17.5% growth from a small base (477k passengers). The FAA's 10-year forecast growth for BGR is 2.2% a year, which is ordinary. A growth-heavy screen may therefore reward a recent jump more than a durable trend.
> 
> **Assumptions and limits**
> - Congestion rests on one month of on-time data (July 2025), and it matters less under these weights.
> - 65 airports in the region were not scored, mostly below the traffic floor. That doesn't mean they scored low.
> - The screen doesn't model cost, returns, or whether the terminal is the binding constraint.
> 
> I can run a demand-gap check on BGR to see whether its growth is putting pressure on capacity or is just a recovery in service.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 939, cache-read 7944 | **Est. cost:** $0.027  
**Grounding:** 26/28 figures traced to tool output; untraced: 90, 4%

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> **Santa Ana (SNA) scores as slightly more congested than LAX on the tool's congestion component, but the two are close on the raw measures.** SNA's congestion score is 65.9 and LAX's is 56. Both come from one month of data, so I wouldn't read much into the gap.
> 
> **Raw measures (July 2025, [On-Time Performance])**
> 
> | Measure | LAX | SNA |
> |---|---|---|
> | Average taxi-out | 17.5 min | 16.4 min |
> | 90th-percentile taxi-out | 26 min | 27 min |
> | Average departure delay | 19.0 min | 18.7 min |
> | Departures delayed 15+ min | 22.9% | 23.8% |
> | Cancelled | 1.2% | 1.4% |
> | Share of delay attributed to the national airspace system | 21.3% | 28.2% |
> 
> - LAX is slightly worse on average taxi-out and average delay. SNA is slightly worse on the worst-case taxi-out, the share of delayed flights, cancellations and airspace-related delay.
> - Most of these differences are a minute or less, so they are effectively ties.
> - Scale differs a lot. LAX has 36.0M passengers over the last 12 months and SNA has 5.5M [T-100]. These measures are per flight, so LAX's total delay burden is much larger.
> 
> **Demand context.** LAX's load factor is 82.2% (88.1% in its peak month), but its passengers are down 4% year on year. SNA's load factor is 79.7% (82.9% at peak), and its passengers are up 2.6%.
> 
> **Assumptions and limits**
> - I took "LA" to mean LAX, the metro's primary airport. BUR, LGB and ONT were not compared. "LA" could also mean Louisiana.
> - Congestion rests on one month of on-time data (July 2025), so it may reflect that season only.
> - On-time data covers large reporting carriers only. Coverage is 72.7% of LAX flights and 88.8% of SNA flights, so smaller-carrier delays are missing, more so at LAX.
> - Taxi-out and delay measure ground and departure-flow congestion. They do not measure runway or terminal capacity.
> - This is a screening comparison, not a valuation or an investment recommendation.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `route_mix({"airport":"ANC"})`  
**Model calls:** 2 | **Tokens:** in 6, out 667, cache-read 3451 | **Est. cost:** $0.020  
**Grounding:** 34/35 figures traced to tool output; untraced: 1,499

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> **About 2.8% of passenger departures from Anchorage (ANC) are long-haul.** That is 1,100 of 39,532 departures. Long-haul flights carry a larger share of passengers, at 6.1% (169,043 passengers). [T-100, 12 months to July 2026]
> 
> - **Main destinations:** Dallas/Fort Worth has the most long-haul departures (389). Atlanta (156), Houston (129), Washington Dulles (110), Newark (101) and New York JFK (71) follow. Frankfurt (30) and Hong Kong (14) are the only ones beyond 4,000 miles.
> - **Short flights dominate:** 49.7% of departures are under 500 miles and 31.3% are 500–1,499 miles.
> 
> **Assumptions and limits**
> - **Definition:** Long-haul means a nonstop segment of 3,000 or more statute miles. There is no official definition, and the answer is sensitive to the cutoff:
> 
> | Threshold | Share of departures |
> |---|---|
> | 1,500+ miles | 19.0% |
> | 2,000+ miles | 14.5% |
> | 2,500+ miles | 9.7% |
> | 3,500+ miles | 0.3% |
> 
> - **Cutoff effect:** DFW is only 3,043 miles away, so it sits just over the 3,000-mile line. That is why the share drops sharply between 2,500 and 3,500 miles.
> - **Cargo excluded:** This covers passenger and combination flights only. ANC has more all-cargo departures (47,717) than passenger ones (39,532). Including cargo would change the answer substantially, and I haven't calculated that figure. I can run it with cargo included if you want.
> - **Segments, not trips:** Distance is for the nonstop leg flown, not the passenger's full journey. Only direct departures from ANC are counted.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 822, cache-read 3448 | **Est. cost:** $0.022  
**Grounding:** 20/23 figures traced to tool output; untraced: 70,000, 14.1%, 11.7%

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **Short answer:** Unmet demand at SFO can't be measured directly. The proxies show modest, localized pressure, not a large unmet-demand problem. The data also suggest the terminal may not be what limits SFO.
> 
> **Proxies (12 months to July 2026)**
> - **Load factor:** The average was 82.1% [T-100]. That is higher than 88% of scored US airports, but below the 85% "full" threshold. Only June 2026 exceeded it, at 87.1%.
> - **Seat shortfall proxy:** About 70,000 extra seats would have kept every month at or below 85%. That is 0.2% of annual seats, all of it in June.
> - **Growth:** Passengers grew 0.6% year over year and seats grew 0.8%. Supply is keeping pace with demand, so there is no sign of demand outrunning seats.
> - **Spill to nearby airports:** Oakland (11 miles away) and San Jose (30 miles) have lower load factors, at 74.4% and 73.5%. Their passenger counts fell 14.1% and 11.7% year over year. That is consistent with some demand already going to SFO, and it suggests the Bay Area has spare capacity elsewhere.
> 
> **Why SFO is constrained**
> - **Ground congestion:** P90 taxi-out is 33 minutes, higher than 90% of scored airports. 23.5% of reporting-carrier departures were delayed 15+ minutes [On-Time Performance].
> - **Runways and weather:** The tool notes that closely spaced parallel runways and fog limit arrivals. A bigger terminal may not raise throughput.
> 
> **Assumptions and limits**
> - The 85% "full" threshold is a rule of thumb. A load factor above it doesn't prove travelers were turned away, because airlines also fill planes by raising fares.
> - The congestion figures rest on one month of on-time data (July 2025), so they may reflect one season.
> - The data can't show these things:
>   - True unconstrained demand, such as travelers who never booked or who chose another mode.
>   - Fares and yield, because airfare data isn't loaded.
>   - Denied boardings, waitlists, and gate or slot constraints.
>   - International or cargo demand beyond what appears in T-100 segments.
> - This is a screening view, not a valuation or an investment recommendation.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 279, cache-read 0 | **Est. cost:** $0.011  
**Grounding:** 0/0 figures traced to tool output

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that one. Whether to buy Delta stock is a question about equities and airline company finances. My tools and data don't cover that, and I don't give investment advice on individual securities or short-term timing.
> 
> I can help with US airport screening, which is the work I'm set up for:
> 
> - **Ranking airports** as candidates for terminal expansion or renovation, nationally or within a state or region.
> - **Comparing airports** side by side on scale, load factors, growth and congestion.
> - **Route mix**, such as what share of an airport's flights are long-haul.
> - **Constrained demand**: proxies for unmet demand at a specific airport, and nearby alternatives that may absorb spill.
> - **Methodology**: how the scores work and what they leave out.
> 
> If you want a starting point, I could rank the top airports nationally or for a region you're interested in. Which would be useful?
