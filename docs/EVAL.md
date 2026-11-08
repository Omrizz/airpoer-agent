# Evaluation run

> **Note:** this run was recorded before the on-time data grew from 1 to 6 months. Figures and rankings in the answers below (for example Portland ranking second in New England) are from the older data and differ from the current snapshot. Re-run `npm run eval` (needs an API key, about $0.30) to refresh it.

Model: `claude-opus-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 34/35 checks passed. Estimated spend: $0.29.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `resolve_airports({"query":"New England"})`, `rank_airports({"region":"New England"})`  
**Model calls:** 3 | **Tokens:** in 8, out 1600, cache-read 10826 | **Est. cost:** $0.066  
**Grounding:** 48/49 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is clearly the strongest candidate in New England. Portland, Maine (PWM) comes second, followed by Bangor (BGR) and Burlington (BTV), which are effectively tied.** Bradley (BDL) is fifth. Rankings use the 12 months from August 2025 to July 2026.
> 
> | Rank | Airport | Score | National rank | What drives it |
> |---|---|---|---|---|
> | 1 | BOS | 72.2 | 11 | Size and forecast growth: 20.9M passengers and 5.6M more enplanements forecast by 2035 (93rd percentile) [FAA TAF]. Taxi-out at the 90th percentile is 35.0 min. |
> | 2 | PWM | 65.1 | 36 | Planes are full: the busiest month averaged 88.9% of seats filled (93rd percentile), and the 12-month average was 81.7%. |
> | 3 | BGR | 63.2 | 38 | Passengers grew 17.5% on the prior year (99th percentile), but it's small at 477k passengers. |
> | 4 | BTV | 63.2 | 39 | Passenger growth beat seat growth by 3.8 points (97th percentile), and taxi-out is 36.4 min. |
> | 5 | BDL | 58.2 | 56 | Load factor is 81.4% and passengers outgrew seats by 2.2 points, but passengers fell 4.3% and the FAA growth outlook is weak. |
> 
> **Why this order**
> - **BOS** wins mainly on size and congestion. Its weak spot is recent traffic, which fell 2.3% year on year. Its case rests on the FAA forecast more than on current momentum.
> - **PWM** is a case built on demand. Its full planes in the busiest months point to pressure on seats, though it's about one-sixteenth the size of BOS.
> - **BGR and BTV** reach the same score in different ways. BGR's score comes from growth, and BTV's from load factor and congestion. BGR's single-year jump of 17.5% is worth checking for one-off causes before relying on it.
> - **Lower down:** Rhode Island's T.F. Green (PVD) scores 52.1, Tweed New Haven (HVN) 49.2 and Manchester (MHT) 41.9. HVN's score has low confidence because it has no on-time data, so its congestion score is missing and the other parts were re-weighted. MHT's load factor is only 74.9% (17th percentile).
> 
> **Assumptions and limits**
> - **Weights:** demand pressure 30%, congestion 25%, growth 25%, size 20%. The top five keep their order when each weight moves by ±20%, except BGR and BTV, which swap places. Treat them as a tie.
> - **Congestion data covers one month only (July 2025, a summer peak).** It may overstate year-round congestion, especially at the Maine and Vermont airports. Taxi-out and delays only stand in for congestion. They don't show whether the terminal, runways or airspace is the real constraint. At MHT (99th percentile) and BGR (100th percentile), a very high share of delay is put down to the air-traffic system. That suggests the problem may be on the airfield, not in the terminal.
> - **Scope:** only 8 of New England's 73 airports with service were scored. The other 65 had too little traffic. These include Nantucket (155k passengers), Worcester (116k), Martha's Vineyard and Portsmouth/Pease. Being left out means they weren't scored, not that they scored low.
> - **Percentiles are national**, measured against 179 airports with at least 300,000 departing passengers a year.
> - **This is a screen, not an investment case.** It shows where extra terminal capacity would likely be used. It doesn't cover construction cost, returns, or current terminal capacity and plans.
> 
> A useful next step would be a demand check on PWM or BTV to see how full they get month by month. Or I can compare BOS with BDL and PVD to see whether the secondary airports are taking overflow from Boston.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1049, cache-read 9871 | **Est. cost:** $0.030  
**Grounding:** 22/28 figures traced to tool output; untraced: 1.9, 5.5, 0.3, 7.8

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> **Portland (PWM) ranks above Bangor (BGR) because it is larger and its planes are fuller. Together those outweigh Bangor's much stronger growth.** PWM scores 65.1 and BGR 63.2, a gap of 1.9 points (derived). Both are measured over the 12 months from August 2025 to July 2026.
> 
> **Where the points come from**, as weighted points PWM minus BGR (derived from the earlier ranking):
> - **Size: PWM +5.5.** PWM carried 1.3M passengers against BGR's 477k. The FAA forecasts 278k more enplanements by 2035 for PWM, against 103k for BGR.
> - **Demand pressure: PWM +3.9.** PWM's average load factor (share of seats filled) was 81.7%, against 79.7% at BGR. In each airport's busiest month it was 88.9% against 87.2%.
> - **Congestion: PWM +0.3.** This is effectively even. BGR has the longer taxi-out (31.0 min against 27.0 min), but PWM has more departures delayed 15 minutes or more (28.7% against 25.0%).
> - **Growth: BGR +7.8.** This is BGR's big advantage. Its passengers grew 17.5% on the prior year (99th percentile), against 0.7% at PWM.
> 
> The net result is +1.9 for PWM. Bangor's single strong signal, growth, isn't quite enough to make up for Portland's lead on size and full planes.
> 
> **How solid is the order?** It held when each weight was moved by ±20%. PWM stayed second in every case, and BGR moved between third and fourth. Still, a 1.9-point gap is narrow. If you weighted growth well beyond that range, BGR would probably move ahead. I haven't run that, but I can if you want to test it.
> 
> **Assumptions and limits**
> - I took "Portland" to mean Portland International Jetport in Maine (PWM), given we're looking at New England.
> - Congestion is based on one month of on-time data (July 2025), so it may reflect the summer peak, which matters for both Maine airports.
> - BGR's 17.5% growth covers a single year from a small base. It's worth checking whether it comes from new routes that will last or from one-off traffic before giving it much weight.
> - This is a screen of where extra terminal capacity would likely be used. It isn't an investment ranking and doesn't model cost or returns.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","weights":{"demand_pressure":0.3,"congestion":0.1,"growth":0.4,"scale":0.2}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1531, cache-read 23587 | **Est. cost:** $0.071  
**Grounding:** 40/40 figures traced to tool output

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **Bangor (BGR) moves into second place, ahead of Portland (PWM), and comes close to Boston (BOS).** BOS still leads with 66.6 against BGR's 63.8. That gap is small enough that the tool's sensitivity check treats them as a tie. Further down, Tweed New Haven (HVN) moves above Rhode Island's T.F. Green (PVD).
> 
> To test this, I set growth to 40% and cut congestion to 10%, leaving demand pressure at 30% and size at 20%. The defaults were 25% for growth and 25% for congestion. Data covers the 12 months from August 2025 to July 2026.
> 
> | Rank (default) | Airport | New score | Default score |
> |---|---|---|---|
> | 1 (1) | BOS | 66.6 | 72.2 |
> | 2 (3) | BGR | 63.8 | 63.2 |
> | 3 (2) | PWM | 60.8 | 65.1 |
> | 4 (4) | BTV | 56.9 | 63.2 |
> | 5 (5) | BDL | 50.1 | 58.2 |
> | 6 (7) | HVN | 49.8 | 49.2 |
> | 7 (6) | PVD | 46.0 | 52.1 |
> | 8 (8) | MHT | 36.6 | 41.9 |
> 
> **Why it moves**
> - **BGR** is the only airport whose score rises meaningfully. Its growth score is 80.1, and passengers grew 17.5% on the prior year (99th percentile). It now overtakes PWM by 3.0 points (derived).
> - **BOS, PWM, Burlington (BTV) and Bradley (BDL)** all drop. They scored well on congestion but only moderately or poorly on growth. BDL falls furthest because of its passenger decline of 4.3% and weak FAA outlook.
> - **HVN** gains a little. It has no congestion data to lose, and its passengers grew 3.6%.
> 
> **A caution on Bangor**
> BGR's lead in growth rests mostly on one year. In the FAA's long-term forecast, BGR looks ordinary: 103k more enplanements by 2035 (21st percentile), against 278k for PWM and 5.6M for BOS. So this weighting rewards recent momentum more than projected need, and BGR is still a small airport with 477k passengers.
> 
> **Assumptions and limits**
> - **The 40/10 split is my choice of what "much more" means.** A different split would move the scores, but the direction should hold.
> - **This ranking is not stable.** Under ±20% weight shifts, BOS and BGR can swap first and second, and BDL drops out of the top five 40% of the time. Treat BOS/BGR and BDL/HVN as ties. PWM (3rd) and BTV (4th) hold their places.
> - **HVN's score is low confidence** because it has no on-time data.
> - **Congestion data still covers one month only (July 2025)**, though it now carries less weight.
> - **Scope is unchanged:** 8 airports scored and 65 left out for low traffic. This is a screen, not a forecast of returns.
> 
> It might help to run a demand check on BGR to see whether the 17.5% growth is holding up month by month or came from a one-off jump.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 1310, cache-read 11428 | **Est. cost:** $0.043  
**Grounding:** 27/28 figures traced to tool output; untraced: 10%

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> Per flight, LAX and John Wayne (SNA) are about equally congested. Each raw measure differs only slightly, and neither airport is worse on all of them. SNA gets the higher congestion score (65.9 vs 56.0, where higher means more congested). Because LAX has about 5x the departures, though, its total delay burden is much larger.
> 
> **I assumed "LA" means LAX**, the main Los Angeles airport. It could also mean the wider LA area, which includes Burbank, Long Beach and Ontario, or the state of Louisiana. I can add any of those if you meant them.
> 
> **How they compare** (on-time data from July 2025 only [On-Time Performance]):
> - **Taxi-out time:** On average, LAX is slower (17.5 vs 16.4 min). In the slowest 10% of departures, SNA is slightly slower (27 vs 26 min).
> - **Departure delay:** The average is almost the same (LAX 19.0, SNA 18.7 min). SNA has a slightly larger share of departures delayed 15 minutes or more (23.8% vs 22.9%).
> - **Cancellations:** SNA 1.4%, LAX 1.2%.
> - **Air traffic system delays:** These make up a bigger share of delay at SNA (28.2% vs 21.3%). Such delays come from the national air traffic system rather than the airlines.
> - **Size:** Over the 12 months to July 2026, LAX handled 36.0M departing passengers on 253,301 passenger flights. SNA handled 5.5M on 50,960 [T-100].
> 
> All the gaps above are about 1 minute or 1 percentage point or less. I worked them out from the tool's figures.
> 
> **Overall scores:** On the full screening score, LAX ranks higher (69.5, 17th nationally) than SNA (61.9, 43rd). LAX's lead comes from its size and higher demand, not congestion. Both scores are rated medium confidence.
> 
> **Assumptions and limits**
> - **One month of delay data:** Congestion is based only on July 2025, so it may reflect summer conditions rather than the whole year. The tool flags this for both airports.
> - **Larger airlines only:** Delay data covers the big airlines that report on-time performance. That's 72.7% of flights at LAX and 88.8% at SNA, so the LAX picture is less complete.
> - **Ground delays, not terminal capacity:** Taxi times and delays measure congestion on the airfield and in the departure flow. They don't tell you whether the terminals are short of space, so congestion alone doesn't show that more terminal capacity is needed.
> - **Scope:** Passenger service only. This is a screening comparison, not a valuation or investment recommendation.
> 
> If it would help, I can look for signs of demand the airports can't currently serve at either one. The tool can only estimate this indirectly.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `resolve_airports({"query":"Anchorage"})`, `route_mix({"airport":"ANC"})`, `route_mix({"airport":"ANC","service":"all"})`  
**Model calls:** 3 | **Tokens:** in 8, out 1157, cache-read 10903 | **Est. cost:** $0.043  
**Grounding:** 35/39 figures traced to tool output; untraced: 81%, 24,600, 52%, 2.8M

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> On passenger flights, **2.8% of departures from Ted Stevens Anchorage International (ANC) are long-haul** (3,000+ miles), and they carry 6.1% of passengers. If you count cargo flights as well, the figure jumps to **29.5%**, because most of ANC's long-haul flying is cargo. [T-100, Aug 2025–Jul 2026]
> 
> **Why the two figures differ**
> - **Passenger flights:** 1,100 of 39,532 departures were 3,000+ miles. Most are domestic flights to the lower 48, led by Dallas/Fort Worth (389 departures), Atlanta (156) and Houston (129). Frankfurt is the main international one (30). About 81% of passenger departures go less than 1,500 miles.
> - **All flights:** ANC had more cargo departures (47,717) than passenger ones. Counting both, 25,743 of 87,249 departures were long-haul. The top long-haul routes are cargo, to Louisville, Miami, Hong Kong, Seoul and Taipei.
> - **Cargo only (my own subtraction):** about 24,600 of 47,717 cargo departures, or roughly 52%, are long-haul.
> 
> **How much the threshold matters**
> The passenger figure depends a lot on where you draw the line, because many routes sit just above 3,000 miles (DFW is 3,043):
> 
> | Long-haul threshold | Passenger departures | Passengers | All departures |
> |---|---|---|---|
> | 2,500+ mi | 9.7% | 20.9% | 41.3% |
> | 3,000+ mi | 2.8% | 6.1% | 29.5% |
> | 3,500+ mi | 0.3% | 0.4% | 16.3% |
> 
> **Assumptions and limits**
> - **Which airport:** "Anchorage" also matched Merrill Field and Elmendorf Air Force Base. I assumed ANC, which is the commercial airport (2.8M passengers in the last 12 months).
> - **Long-haul definition:** There's no official one. I used a nonstop leg of 3,000+ statute miles, and the table shows how the answer changes with other cutoffs.
> - **What's counted:** Departures from ANC on nonstop legs. A connecting passenger counts on each leg, so this measures the flight, not the whole trip. The passenger share weights each flight by how many people were on it.
> - **Data:** BTS T-100, August 2025 to July 2026.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1103, cache-read 8878 | **Est. cost:** $0.024  
**Grounding:** 21/25 figures traced to tool output; untraced: 70,000, 10%, 14.1%, 11.7%

**Checks:** PASS calls demand_gap; FAIL mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **SFO shows little sign of unmet passenger demand in seats.** Planes are fairly full, but only one month in the last 12 went above the "full" threshold. Seat supply grew slightly faster than passengers. SFO's real pressure is on the ground and in the air: taxi times and delays are high, and the airport's runways and fog weather limit arrivals. A bigger terminal may not fix either.
> 
> **What the numbers show (12 months to July 2026)** [T-100]
> - **Planes are full but not overfull.** On average 82.1% of seats were filled, which is higher than at 88% of scored US airports. Only June 2026 went above 85% full, at 87.1%.
> - **The seat gap is small.** About 70,000 extra seats (0.2% of annual seats) would have kept every month at or below 85% full. All of that gap comes from June. Treat it as a rough indicator, not a count of travellers who were turned away.
> - **Supply is keeping up with demand.** Passengers rose 0.6% year on year, while seats rose 0.8%.
> - **Taxi times and delays are high** [On-Time Performance]. The slowest 10% of departures took 33 minutes or more to taxi out, which is worse than at 90% of scored airports. 23.5% of departures by the airlines that report on-time data left 15+ minutes late.
> - **Some travellers may already be going to nearby airports.** Oakland (11 miles away, 74.4% of seats filled) and San Jose (30 miles, 73.5%) both have emptier planes. Their passenger numbers fell 14.1% and 11.7% year on year, so they have room to take extra travellers. The data can't show whether people actually switched airports.
> 
> **Why demand looks this way**
> SFO's limit seems to be how many planes it can land, not how many passengers its terminals can handle. Its parallel runways sit close together, and fog cuts the number of landings. That fits the pattern above: planes fairly full and long delays, but no steady seat shortage. If more terminal space doesn't allow more flights to land, it may not let the airport carry more passengers.
> 
> **Assumptions and limits**
> - **No direct measure:** "Unmet demand" can't be measured directly. Everything above is an indirect indicator.
> - **The 85% "full" line is a rule of thumb.** If the line were set lower, more months would count as full and the seat gap would grow. I didn't rerun the numbers with another line, but I can.
> - **Full planes don't prove people were turned away.** Airlines also fill planes by changing fares, and fare data isn't loaded.
> - **The delay figures rest on one month: July 2025.** That month is outside the 12-month passenger window, so the figures may reflect one season.
> - **What's not covered:** travellers who never booked or chose another way to travel, denied boarding and waitlists, gate or slot limits, and cargo or international demand beyond the flight data.
> - **This is a screen, not an investment case.** Costs and returns aren't modelled.
> 
> If it helps, I can compare SFO with Oakland and San Jose side by side, or rerun this with a different "full" threshold.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 370, cache-read 3447 | **Est. cost:** $0.008  
**Grounding:** 0/1 figures traced to tool output; untraced: 100,

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that. Whether to buy airline stock, or when, is outside what I do. I have no market, earnings or share-price data, and I don't give investment advice on securities.
> 
> What I can do is screen US airports for terminal investment using public aviation data (BTS T-100, On-Time Performance, FAA Terminal Area Forecast). For example, I can:
> 
> - **Rank airports** nationally or within a region by demand pressure, congestion, growth outlook and size.
> - **Compare airports** side by side, such as Delta hubs like ATL, DTW, MSP and SLC, on load factors, growth and congestion.
> - **Look for signs of constrained demand** at a single airport, using proxies like full flights, seat shortfall and nearby alternatives.
> - **Break down an airport's routes by distance**, for example its share of long-haul flights.
> 
> Any of these would show where traffic is concentrated and under strain. They wouldn't tell you how Delta as a company or its stock will perform. If one of them would help, tell me which airports or region you'd like to look at.
