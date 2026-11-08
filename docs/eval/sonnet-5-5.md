# Evaluation run

Model: `claude-sonnet-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.11.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1094, cache-read 6900 | **Est. cost:** $0.027  
**Grounding:** 31/32 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest New England candidate. Portland, ME (PWM) is second, and Bangor (BGR), Burlington (BTV) and Bradley (BDL) follow.** Scores are out of 100, from the 12 months to July 2026.
> 
> | Rank | Airport | Score | Main drivers |
> |---|---|---|---|
> | 1 | BOS | 72.2 | 20.9M passengers. P90 taxi-out is 35.0 min. FAA forecasts 5.6M added enplanements by 2035. |
> | 2 | PWM | 65.1 | Load factor is 81.7%, and the peak month is 88.9%. |
> | 3 | BGR | 63.2 | Passenger growth is 17.5% year on year, but the airport is small at 477k passengers. |
> | 4 | BTV | 63.2 | P90 taxi-out is 36.4 min. Passenger growth exceeds seat growth by 3.8 points (derived from the tool's gap metric). |
> | 5 | BDL | 58.2 | Load factor is 81.4%. Passenger growth is -4.3% and the 10-year forecast growth is weak. |
> 
> PVD (52.1), HVN (49.2) and MHT (41.9) rank 6 to 8.
> 
> **Reasons and uncertainty**
> - **BOS:** It scores well on size and congestion. Its growth score is middling, because passengers fell 2.3% year on year.
> - **PWM:** It ranks well on demand pressure. Its peak-month load factor is in the 93rd percentile nationally.
> - **BGR and BTV:** They are effectively tied. Their ranks swap under ±20% weight changes. BGR's score leans on growth from a small base.
> - **Stability:** The top five airports stay in the top five when each weight is shifted by ±20%. The order within BGR/BTV is the only change.
> - **BDL:** Its rank rests on demand pressure and scale. Its growth score is low.
> - **HVN:** It has no congestion data, so its score is re-weighted over the other components. Confidence is low.
> 
> **Assumptions and limits**
> - Default weights are demand pressure 30%, congestion 25%, growth 25% and scale 20%.
> - Congestion uses one month of on-time data (July 2025, a summer peak). It may overstate year-round congestion, especially at seasonal airports such as PWM and BGR.
> - Taxi-out and delay times are proxies for congestion. They are not measures of runway capacity.
> - Percentiles are national, among 179 airports with at least 300,000 departing passengers a year.
> - 65 New England airports with some traffic were not scored, mostly because they are below the traffic floor. Examples are Nantucket, Worcester and Martha's Vineyard. Not being scored does not mean a low score.
> - This is a screen. It does not model construction cost or returns, and it does not test whether the terminal is the binding constraint. At airports where the gating factor is airfield or airspace, terminal capacity may not be absorbed.
> 
> I can run a demand-gap check on BOS or PWM, or re-rank with different weights, if that would help.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1067, cache-read 9397 | **Est. cost:** $0.015  
**Grounding:** 39/43 figures traced to tool output; untraced: 1.9, 0.3, 7.8, 5.5

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> Portland ranks above Bangor because it is stronger on demand pressure and scale. Bangor is stronger only on growth, and that doesn't fully offset the gap. The final scores are 65.1 for PWM and 63.2 for BGR, a 1.9-point gap (derived).
> 
> Weighted points by component, PWM vs BGR:
> 
> | Component | PWM | BGR | Difference (derived) |
> |---|---|---|---|
> | Demand pressure (30%) | 24.0 | 20.1 | PWM +3.9 |
> | Congestion (25%) | 19.5 | 19.2 | PWM +0.3 |
> | Growth (25%) | 12.2 | 20.0 | BGR +7.8 |
> | Scale (20%) | 9.4 | 3.9 | PWM +5.5 |
> 
> - **Demand pressure:** PWM's load factor is 81.7% (84th percentile), against 79.7% (60th) for BGR. PWM's peak-month load factor is 88.9% (93rd percentile), against 87.2% (79th) for BGR.
> - **Scale:** PWM handles 1.3M passengers (47th percentile) and BGR handles 477k (17th). The FAA forecasts 278k added enplanements at PWM and 103k at BGR.
> - **Congestion:** The two are nearly level. BGR has the higher P90 taxi-out at 31.0 min, against 27.0 min for PWM. PWM has more departures delayed 15+ minutes, at 28.7% against 25.0%.
> - **Growth:** BGR's passengers grew 17.5% year on year (99th percentile), against 0.7% for PWM. This is BGR's main advantage.
> 
> **Assumptions and limits**
> - **Stable ranking:** PWM stays at rank 2 under ±20% weight changes. BGR sits at 3 to 4 and swaps with BTV. Weights that put much more emphasis on growth could change the PWM/BGR order. I haven't tested that. I can re-run the ranking with growth weighted more heavily.
> - **Small base:** BGR's growth is measured from a small base. A 17.5% rise may not persist, and it could reflect new airline service rather than lasting demand.
> - **Congestion data:** Both airports' congestion scores rest on one month of on-time data (July 2025). The differences between them there are small and shouldn't be over-read.
> - **Scope:** This is a screen. It doesn't model cost or returns, or whether the terminal is the binding constraint.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","weights":{"growth":0.5,"congestion":0.1,"demand_pressure":0.25,"scale":0.15}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1087, cache-read 22003 | **Est. cost:** $0.033  
**Grounding:** 38/40 figures traced to tool output; untraced: 9.2, 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **Bangor moves to first, Boston to second and Portland to third.** I re-ran the ranking with weights of growth 50%, demand pressure 25%, scale 15% and congestion 10%. This is my own interpretation of "much more growth than congestion". The defaults were 25% growth and 25% congestion.
> 
> | Airport | New rank (old) | New score (old) |
> |---|---|---|
> | BGR | 1 (3) | 67.4 (63.2) |
> | BOS | 2 (1) | 63.0 (72.2) |
> | PWM | 3 (2) | 59.3 (65.1) |
> | BTV | 4 (4) | 54.8 (63.2) |
> | HVN | 5 (7) | 50.7 (49.2) |
> | BDL | 6 (5) | 44.2 (58.2) |
> | PVD | 7 (6) | 42.9 (52.1) |
> | MHT | 8 (8) | 36.5 (41.9) |
> 
> **Why the order changed**
> - **BGR** has the best growth score in the group (80.1). Its passengers grew 17.5% year on year. That growth now accounts for 40.1 of its 67.4 points.
> - **BOS** falls by 9.2 points (derived) because its growth score is middling (46.2). Passengers fell 2.3%, though the FAA 10-year forecast growth is above average. It stays second because of its size score (92.2) and demand pressure.
> - **BDL** falls two places, from fifth to sixth. Its growth score is the lowest in the group (14.4), with passengers down 4.3%. HVN moves up to fifth, helped by 3.6% growth.
> - **Congestion** barely moves the order at 10% weight. BTV, BOS and PWM have similar congestion scores, between 78 and 84.
> 
> **Assumptions and limits**
> - **Growth metrics:** The growth component combines last-year passenger growth with the FAA 10-year forecast. BGR's lead comes mostly from the recent 17.5% jump, which is measured from a small base (477k passengers). It may not persist, and the lead rests on one year's change.
> - **Stability:** The sensitivity check says the top five are stable under ±20% shifts around these new weights. That only covers small changes around this setting. The ordering at the top is still sensitive to how heavily growth is weighted overall.
> - **Congestion data:** The congestion scores still rest on one month of on-time data (July 2025), so they may overstate year-round conditions.
> - **HVN:** It has no congestion data and its confidence is low, so its score is re-weighted over the other components.
> - **Scope:** Eight airports were scored. 65 smaller ones were not, and that does not mean they scored low. This is a screen, not a valuation. It doesn't model cost or returns, or whether the terminal is the binding constraint.
> 
> At BGR, a demand-gap check would show whether the growth comes with high load factors or whether seat additions are outpacing demand.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 979, cache-read 14338 | **Est. cost:** $0.013  
**Grounding:** 24/27 figures traced to tool output; untraced: 90, 4.0%

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> **Bottom line:** LAX and Santa Ana (SNA) have very similar congestion per flight, and SNA scores slightly higher on the congestion component (65.9 vs 56.0). That gap comes mostly from SNA's higher share of delayed departures and its longer worst-case taxi-outs. LAX is far larger, so its total delay burden is bigger.
> 
> **Figures** [On-Time Performance, July 2025]
> 
> | Measure | LAX | SNA |
> |---|---|---|
> | Average taxi-out | 17.5 min | 16.4 min |
> | 90th-percentile taxi-out | 26 min | 27 min |
> | Average departure delay | 19.0 min | 18.7 min |
> | Departures delayed 15+ min | 22.9% | 23.8% |
> | Cancelled | 1.2% | 1.4% |
> | Delay share attributed to the national airspace system | 21.3% | 28.2% |
> 
> - LAX is slightly worse on average taxi-out and average delay. SNA is slightly worse on 90th-percentile taxi-out, delayed share, cancellations and airspace-system delay share. These differences are small, and I'd treat the two as roughly equal on congestion.
> - For scale, LAX handled 36.0M passengers over the last 12 months and SNA handled 5.5M [T-100].
> - Demand context: LAX's load factor is 82.2% against SNA's 79.7%. Passenger numbers fell 4.0% year on year at LAX and rose 2.6% at SNA.
> 
> **Assumptions and limits**
> - I took "LA" to mean LAX, the primary Los Angeles airport. "LA" can also mean Louisiana, and BUR, LGB and ONT are other airports in the LA area. Tell me if you meant a different one.
> - Congestion rests on **one month of data (July 2025)**, so it may reflect summer conditions only. Both airports carry that flag.
> - The on-time data covers large reporting carriers only. Coverage is 72.7% of flights at LAX and 88.8% at SNA, so LAX's figures are less complete.
> - Taxi-out and delay measure ground and departure-flow congestion. They don't measure runway or terminal capacity, so they say little about whether terminal space is the binding constraint.
> - The congestion score is a percentile ranking within the peer set. It is a screening input, not a valuation or an investment recommendation.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `route_mix({"airport":"ANC"})`  
**Model calls:** 2 | **Tokens:** in 6, out 622, cache-read 8387 | **Est. cost:** $0.008  
**Grounding:** 31/32 figures traced to tool output; untraced: 1,499

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> **About 2.8% of Anchorage's passenger departures are long-haul.** That is 1,100 of 39,532 departures in the 12 months to July 2026 [T-100]. Long-haul flights carry a bigger share of passengers, 6.1% (169,043 passengers).
> 
> **Reasons**
> - Most flights are short. 49.7% of departures go under 500 miles and 31.3% go 500–1,499 miles.
> - Nearly all long-haul departures are domestic hub routes. DFW has 389 departures, ATL 156, IAH 129, IAD 110 and EWR 101.
> - International flights are only 0.7% of departures. Frankfurt has 30 departures and Hong Kong has 14.
> 
> **Assumptions and limits**
> - **Definition:** Long-haul means a nonstop segment of 3,000 miles or more. There is no official definition, and the answer is sensitive to the cutoff:
> 
> | Cutoff | Share of departures |
> |---|---|
> | 1,500+ miles | 19.0% |
> | 2,000+ miles | 14.5% |
> | 2,500+ miles | 9.7% |
> | 3,000+ miles | 2.8% |
> | 3,500+ miles | 0.3% |
> 
> - **Cargo excluded:** This covers passenger and combination flights only. Anchorage has more all-cargo departures (47,717) than passenger departures (39,532). Including cargo would change the percentage a lot. I can run the cargo or all-flights version if you want it.
> - **Segments, not trips:** Distance is the nonstop leg flown, not the passenger's full trip. A connecting passenger counts once on each leg.
> - **Origin only:** Only departures from Anchorage are counted.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 772, cache-read 8878 | **Est. cost:** $0.010  
**Grounding:** 23/24 figures traced to tool output; untraced: 70,000

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **Short answer:** Unmet demand at SFO can't be measured directly, and the proxies point to modest constrained demand. The data shows little sign of large unserved demand. The binding constraint may be the airfield rather than the terminal.
> 
> **Proxies (12 months to July 2026)**
> - **Load factor:** Seats were 82.1% full on average [T-100]. That is high relative to other airports, higher than 88% of scored US airports. Only 1 of 12 months went above the 85% "full" line: June 2026 at 87.1%.
> - **Seat shortfall proxy:** About 70,000 extra seats would have kept every month at or below 85%. That is roughly 0.2% of annual seats. It all comes from June.
> - **Growth:** Passengers grew 0.6% year over year and seats grew 0.8%. Supply is keeping pace with demand, so demand isn't outrunning capacity.
> - **Spill to nearby airports:** OAK (11 miles) and SJC (30 miles) have lower load factors, 74.4% and 73.5%. Both lost passengers year over year (-14.1% and -11.7%). That is consistent with some demand already going to them, but it doesn't prove it.
> 
> **Why SFO is constrained**
> - **Ground congestion:** P90 taxi-out is 33 minutes, higher than 90% of scored airports. 23.5% of reporting-carrier departures were delayed 15+ minutes [On-Time Performance].
> - **Airfield limits:** The tool notes that closely spaced parallel runways and fog limit arrivals. A bigger terminal may not raise throughput.
> 
> **Assumptions and limits**
> - The 85% threshold is a rule of thumb, not a measurement. A high load factor doesn't prove travellers were turned away, because airlines also fill planes by raising prices.
> - The congestion figures rest on one month of on-time data (July 2025) and may reflect that season only.
> - The data can't show true unconstrained demand, fares or yield, denied boardings or waitlists, gate or slot constraints, or international and cargo demand beyond T-100 segments.
> - This is a screening view, not a valuation or an investment recommendation.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 375, cache-read 3447 | **Est. cost:** $0.004  
**Grounding:** 0/1 figures traced to tool output; untraced: 100,

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that one. Buying Delta stock is an equity investment decision, and it's outside what I cover. I only work with US airport data from BTS T-100, BTS On-Time Performance, the FAA Terminal Area Forecast and OurAirports. I also don't predict returns or give recommendations on securities.
> 
> Here is what I can do on the airport side:
> 
> - **Rank airports** as candidates for terminal expansion or renovation. This uses demand pressure, congestion, growth outlook and size of prize, and I can do it nationally or for a region or state.
> - **Compare airports** side by side on scale, load factors, growth and congestion.
> - **Check for constrained demand** at a specific airport. This uses proxies such as full-flight months and seat shortfall, because unmet demand can't be measured directly.
> - **Break down route mix**, such as the share of long-haul flights from an airport.
> 
> If you're looking at airports where Delta has a large presence, tell me which ones, for example ATL, MSP, DTW or SLC. I can run a comparison or a demand check on them. These are screening results on airport capacity. They aren't a view on the airline or its stock.
