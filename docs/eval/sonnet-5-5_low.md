# Evaluation run

Model: `claude-sonnet-5-5`, effort: `low`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.12.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1080, cache-read 6900 | **Est. cost:** $0.027  
**Grounding:** 37/38 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest New England candidate.** Portland, ME (PWM) is next. Bangor (BGR), Burlington (BTV) and Bradley (BDL) follow. BOS scores 72.2 and is 11th nationally. PWM scores 65.1 and BGR and BTV each score 63.2. BDL scores 58.2.
> 
> **Why they rank where they do**
> - **BOS:** It has the largest size of prize, with 20.9M passengers [T-100] and 5.6M FAA-forecast added enplanements by 2035. It also has high congestion, with a 35.0-minute P90 taxi-out. Its weak spot is growth: passengers fell 2.3% year on year.
> - **PWM:** Demand pressure is high. Its load factor is 81.7%, and its peak month is 88.9% (93rd percentile nationally). It is a much smaller airport, at 1.3M passengers.
> - **BGR:** Passenger growth is 17.5%, but the airport is small, at 477k passengers. Its congestion reading includes a 45% share of delay minutes from air-system volume, which may be noisy at this size.
> - **BTV:** It has a 36.4-minute P90 taxi-out and a passenger-growth-minus-seat-growth gap of +3.8%. Passengers fell 1.8% year on year.
> - **BDL:** Demand is firm, with an 81.4% load factor and a +2.2% passenger-minus-seat growth gap. Growth is weak: passengers fell 4.3% and the 10-year FAA forecast growth rate is 1.5%.
> - **Lower ranks:** PVD (52.1), HVN (49.2) and MHT (41.9) score lower. MHT's load factor is 74.9%.
> 
> **Assumptions and limits**
> - **Stability:** The top five held under ±20% weight shifts. BGR and BTV are tied, and they swap ranks 3 and 4 in some cases.
> - **Weights:** Demand pressure 30%, congestion 25%, growth 25%, scale 20%. Percentiles are national, against 179 airports with at least 300,000 departing passengers a year.
> - **Congestion data:** It rests on one month of on-time data, July 2025, which is a summer peak. It may overstate year-round congestion, especially for seasonal airports such as PWM and BGR. Taxi-out and delay are proxies, not measures of runway capacity.
> - **HVN:** It has no on-time data, so its score is re-weighted over the other components and confidence is low.
> - **Not scored:** 65 airports in the region fell below the traffic floor, including ACK, ORH and MVY. They were not scored, which is not the same as scoring low.
> - **What this is:** A screen of where added capacity might be absorbed. It does not model cost, returns, or whether the terminal is the binding constraint, as opposed to runways or airspace. It is not an investment recommendation.
> - **Data period:** T-100 covers the 12 months to July 2026. The forecast is the FAA Terminal Area Forecast, 2025 edition.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 770, cache-read 9397 | **Est. cost:** $0.012  
**Grounding:** 38/42 figures traced to tool output; untraced: 1.9, 0.3, 7.8, 5.5

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> PWM scores 65.1 and BGR scores 63.2, a gap of 1.9 points. PWM is ahead because of its demand pressure and its size. Bangor's growth score offsets most of that. I'm using the earlier ranking results, with component points derived by subtraction.
> 
> | Component (weight) | PWM points | BGR points | Difference |
> |---|---|---|---|
> | Demand pressure (30%) | 24.0 | 20.1 | PWM +3.9 |
> | Congestion (25%) | 19.5 | 19.2 | PWM +0.3 |
> | Growth (25%) | 12.2 | 20.0 | BGR +7.8 |
> | Size of prize (20%) | 9.4 | 3.9 | PWM +5.5 |
> 
> - **Demand pressure:** PWM has an 81.7% load factor (84th percentile), against 79.7% (60th) for BGR. PWM's peak-month load factor is 88.9% (93rd percentile), against 87.2% (79th) for BGR.
> - **Size of prize:** PWM carries 1.3M passengers, against 477k for BGR. Its FAA-forecast added enplanements are 278k, against 103k.
> - **Congestion:** The two are close. BGR has the longer P90 taxi-out, at 31.0 minutes against 27.0. PWM has more departures delayed 15+ minutes, at 28.7% against 25.0%.
> - **Growth:** BGR is well ahead. Its passenger growth is 17.5% (99th percentile), against 0.7% for PWM.
> 
> **Assumptions and limits**
> - **Weights:** The ranking is sensitive to them. In the ±20% weight test, PWM held rank 2 in every case and BGR ranged from 3 to 4. PWM's lead on rank held up, but the points gap is small. Giving more weight to growth would narrow it, and I did not test that case.
> - **Growth:** BGR's 17.5% is a single year-on-year figure on a small base, so it may not persist.
> - **Congestion:** Both airports' congestion scores rest on one month of on-time data, July 2025. BGR's 45% air-system delay share comes from that same month.
> - **What this is:** A screen, not a valuation. It does not model cost, returns, or whether the terminal is the binding constraint.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","weights":{"growth":0.45,"congestion":0.1,"demand_pressure":0.25,"scale":0.2}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1045, cache-read 21676 | **Est. cost:** $0.032  
**Grounding:** 38/39 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **Bangor (BGR) moves up to a near-tie with Boston (BOS) and passes Portland (PWM).** I re-ran the ranking with growth at 45%, congestion at 10%, demand pressure at 25% and size of prize at 20%. These weights are my choice for "much more growth than congestion".
> 
> | Rank | Airport | Score (previous score) |
> |---|---|---|
> | 1 | BOS | 65.3 (72.2) |
> | 2 | BGR | 64.4 (63.2) |
> | 3 | PWM | 59.2 (65.1) |
> | 4 | BTV | 54.5 (63.2) |
> | 5 | HVN | 49.4 (49.2) |
> | 6 | BDL | 46.8 (58.2) |
> | 7 | PVD | 44.4 (52.1) |
> | 8 | MHT | 36.2 (41.9) |
> 
> **What changed**
> - **BGR:** Its growth score is 80.1, driven by 17.5% passenger growth. At 45% weight that adds 36.1 points. BOS adds 20.8 points from growth, and PWM adds 22.0.
> - **BOS:** It stays first because of size of prize (92.2) rather than growth. Its growth score is only 46.2, and passengers fell 2.3%. The gap to BGR is 0.9 points, which is effectively a tie. The sensitivity test shows the two swapping ranks 1 and 2.
> - **PWM:** It drops behind BGR. Its lead came from demand pressure, and that now carries less weight.
> - **BTV and BDL:** BTV falls from 63.2 to 54.5. BDL falls from 58.2 to 46.8 and from fifth to sixth, with HVN moving up to fifth. Both have weak growth, and BDL's growth score is 14.4.
> - **HVN:** It has no congestion data, so it was re-weighted over the other components. That makes the change in its score less comparable. HVN and BDL are close, and their order is not firm. HVN's fifth place came in 90% of the sensitivity cases.
> 
> **Assumptions and limits**
> - **Growth measures:** The growth score mixes one-year passenger growth with the FAA 10-year forecast growth rate. BGR's strength comes mostly from the one-year figure on a small base (477k passengers). It may not persist, and its forecast growth is a more ordinary 2.2%.
> - **Congestion:** It still rests on one month of on-time data, July 2025. Cutting its weight reduces that exposure, but it does not remove it.
> - **Not scored:** 65 airports in the region fell below the traffic floor. They were not scored, which is not the same as scoring low.
> - **What this is:** A screen, not a valuation. It does not model cost, returns, or whether the terminal is the binding constraint.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 870, cache-read 11393 | **Est. cost:** $0.018  
**Grounding:** 26/28 figures traced to tool output; untraced: 90

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> **Bottom line:** LAX and John Wayne (SNA) are about equally congested per flight. SNA scores slightly higher on the tool's congestion component (65.9 vs 56.0, where higher means more congested). That edge is small and rests on one month of data.
> 
> **Key figures** (on-time data for July 2025 [On-Time Performance])
> 
> | Measure | LAX | SNA |
> |---|---|---|
> | Average taxi-out | 17.5 min | 16.4 min |
> | 90th-percentile taxi-out | 26 min | 27 min |
> | Average departure delay | 19.0 min | 18.7 min |
> | Departures delayed 15+ min | 22.9% | 23.8% |
> | Cancelled | 1.2% | 1.4% |
> | Share of delay attributed to the national air system | 21.3% | 28.2% |
> 
> - LAX is a little worse on average taxi-out. SNA is a little worse on the 90th-percentile taxi-out, delay frequency, cancellations and national-system delay share.
> - The gaps are about a minute or a point or two. I wouldn't read them as a real difference.
> - LAX's total delay burden is much larger because it handles about 6.5 times SNA's passengers: 36.0M vs 5.5M over the 12 months to July 2026 [T-100].
> 
> **Assumptions and limits**
> - I took "LA" to mean LAX. Burbank, Long Beach and Ontario were not compared. "LA" could also mean Louisiana.
> - Congestion rests on a single month, July 2025, so it may reflect that season only.
> - The on-time data covers large reporting carriers only. Coverage is 72.7% at LAX and 88.8% at SNA, so LAX's figures are less complete.
> - Taxi-out and delay measure ground and departure-flow congestion. They do not measure runway or terminal capacity.
> - The overall investment scores are 69.5 for LAX (rank 17) and 61.9 for SNA (rank 43). These are screening scores, not a valuation or a recommendation. Congestion is only one of four components.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `route_mix({"airport":"ANC"})`  
**Model calls:** 2 | **Tokens:** in 6, out 664, cache-read 6902 | **Est. cost:** $0.012  
**Grounding:** 33/34 figures traced to tool output; untraced: 1,499

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> **About 2.8% of passenger departures from Anchorage (ANC) are long-haul.** That is 1,100 of 39,532 departures in the 12 months to July 2026 [T-100]. Long-haul flights carry a bigger share of passengers, at 6.1% (169,043 passengers).
> 
> - **Main destinations:** Dallas/Fort Worth has the most long-haul departures (389). Atlanta (156), Houston (129), Washington Dulles (110) and Newark (101) follow. Frankfurt (30) and Hong Kong (14) are the only 4,000+ mile routes in the top group.
> - **Distance mix:** 49.7% of departures are under 500 miles. 31.3% are 500–1,499 miles. 16.2% are 1,500–2,999 miles.
> 
> **Assumptions and limits**
> - **Definition:** Long-haul here means a nonstop leg of 3,000+ statute miles. There is no official definition, and the answer is sensitive to the cutoff:
> 
>   | Cutoff | Share of departures |
>   |---|---|
>   | 1,500 miles | 19.0% |
>   | 2,000 miles | 14.5% |
>   | 2,500 miles | 9.7% |
>   | 3,500 miles | 0.3% |
> 
>   The share falls sharply near 3,000 miles because many routes sit just above or just below that line. Dallas/Fort Worth, for example, is 3,043 miles.
> - **Passenger flights only:** ANC has more all-cargo departures (47,717) than passenger departures. Including cargo would change the answer a lot. I can run a cargo-only or combined view if you want it.
> - **Legs, not trips:** The figures count each nonstop leg. A connecting passenger counts once on each leg, so they don't describe full trips.
> - **Departures only:** Arrivals are not counted.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 796, cache-read 6896 | **Est. cost:** $0.014  
**Grounding:** 19/20 figures traced to tool output; untraced: 70,000

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **Short answer:** The data doesn't show a large amount of unmet demand at SFO, and unmet demand can't be measured directly. The proxies point to modest seat pressure in peak months. They also point to ground and airfield congestion that a bigger terminal may not fix.
> 
> **Proxies (12 months to July 2026)**
> - **Load factor:** The average was 82.1% [T-100], which is higher than 88% of scored US airports. Only 1 of 12 months went above the 85% "full" threshold. That month was June 2026, at 87.1%.
> - **Seat shortfall proxy:** About 70,000 extra seats would have kept every month at or below 85%. That is roughly 0.2% of annual seats, and it is all in June.
> - **Growth:** Passengers grew 0.6% year over year and seats grew 0.8%. Supply is keeping pace with demand, so there is no sign of a widening gap.
> - **Spill to nearby airports:** OAK (74.4% load factor) and SJC (73.5%) are fuller than SFO is not, and both have spare capacity. This is consistent with some demand already going there, but it doesn't prove it.
> - **Congestion:** The P90 taxi-out is 33 minutes, which is higher than 90% of scored airports. 23.5% of departures were delayed 15+ minutes [On-Time Performance].
> 
> **Why it's constrained**
> The tool notes that closely spaced parallel runways and fog limit arrivals. The binding constraint may therefore be the airfield, not the terminal, and added terminal space may not raise throughput.
> 
> **Assumptions and limits**
> - The 85% "full" threshold is a rule of thumb. A high load factor doesn't prove travelers were turned away, because airlines also fill planes by raising prices.
> - The congestion figures rest on one month of on-time data (July 2025) and may reflect that season only.
> - These things can't be measured here: true unconstrained demand, fares and yield, denied boardings or waitlists, gate and slot limits, and international or cargo demand beyond the T-100 segments.
> - This is a screening view. It is not a valuation or an investment recommendation.
> 
> I can compare SFO with OAK and SJC, or rank Bay Area or California airports, if that would help.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 332, cache-read 3447 | **Est. cost:** $0.004  
**Grounding:** 0/1 figures traced to tool output; untraced: 100

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that one. Whether to buy Delta stock is a question about securities and airline financials. It's outside what I cover, and I won't predict returns or give investment advice on individual stocks.
> 
> I work only with US airport data (BTS T-100 and On-Time Performance, the FAA Terminal Area Forecast, and OurAirports). With that data I can:
> 
> - **Rank airports** as candidates for terminal expansion or renovation, nationally or within a state or region.
> - **Compare airports** side by side on scale, demand and congestion.
> - **Break down route mix**, for example the share of long-haul flights from a given airport.
> - **Look at constrained demand** at one airport, using proxies such as load factors and seat shortfalls.
> - **Explain how the scoring works** and what it doesn't model.
> 
> If you're interested in the airports where Delta operates, tell me which ones, such as ATL, MSP or SLC. I can compare them on demand and congestion. That would be a screening of airport capacity, not a view on the stock.
