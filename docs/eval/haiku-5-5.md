# Evaluation run

Model: `claude-haiku-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.01.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England","top_n":10})`  
**Model calls:** 2 | **Tokens:** in 6, out 2248, cache-read 3450 | **Est. cost:** $0.002  
**Grounding:** 47/51 figures traced to tool output; untraced: 2.3%, 0.5%, 0.6%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest candidate in New England, and Portland (PWM), Bangor (BGR), Burlington (BTV) and Hartford (BDL) follow.** BOS scores 72.2 and is the only large hub in the group. The next four are closer together, and BGR and BTV are effectively tied.
> 
> | Rank (region) | Airport | Score | LTM passengers | Key signal |
> |---|---|---|---|---|
> | 1 | BOS Boston Logan | 72.2 | 20.9M | P90 taxi-out 35.0 min (93rd percentile) |
> | 2 | PWM Portland | 65.1 | 1.3M | Peak-month load factor 88.9% (93rd percentile) |
> | 3 | BGR Bangor | 63.2 | 477k | Passenger growth +17.5% year on year |
> | 4 | BTV Burlington | 63.2 | 701k | Passengers minus seats +3.8% (97th percentile) |
> | 5 | BDL Hartford | 58.2 | 3.2M | 12-month load factor 81.4% |
> 
> **Reasons**
> - **BOS:** It leads on scale (20.9M passengers) and congestion. About 27.9% of departures were delayed 15+ minutes, and 31.4% of delay minutes were volume-related (NAS). The FAA forecast adds 5.6M enplanements by 2035 [TAF]. Its growth score is weak, though: passengers fell 2.3% year on year.
> - **PWM:** Demand pressure is high relative to its size. The peak month ran at 88.9% load factor.
> - **BGR:** Growth is the main driver, but the base is small (477k passengers), so the percentage swing is easy to reach.
> - **BTV:** Passengers grew 3.8 points faster than seats, the second-strongest constraint signal in the group, and taxi-out times are long (P90 36.4 min).
> - **BDL:** It has the largest traffic base after BOS, but passengers fell 4.3% year on year, which pulls its growth score down.
> 
> **Uncertainty**
> - BGR and BTV tie at 63.2. Under ±20% weight shifts they swap places, so treat them as one tier.
> - The top five hold their order or move by at most one place under ±20% weight shifts.
> - Congestion rests on one month of on-time data (July 2025), a summer peak. It may overstate year-round congestion.
> - Taxi-out and delay are proxies, not measures of runway capacity.
> - Several airports show little or negative passenger growth against seats (BOS −0.5%, PWM −0.5%, MHT −0.6%). For these, the terminal may not be the binding constraint.
> - Tweed New Haven (HVN, 49.2, low confidence) has no congestion data, so its score is based on other components only. Its passengers grew 4.3 points faster than seats, but I would not rank it on this score alone.
> 
> **Assumptions and limits**
> - Scores screen where added capacity would be absorbed. They are not a valuation, a return estimate, or an investment recommendation, and they do not estimate construction cost.
> - Default weights: demand pressure 30%, congestion 25%, growth 25%, scale 20%. Percentiles are national, among 179 airports with at least 300,000 departing passengers a year.
> - Traffic period: 12 months to July 2026 [T-100]. On-time data covers July 2025 only.
> - Scope: 65 New England airports with some traffic were not scored, because they fall below the 300,000-departing-passenger floor. The largest of these are Nantucket (about 155k passengers) and Worcester (about 116k). A missing airport means it was not scored, not that it scored low.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1278, cache-read 9580 | **Est. cost:** $0.001  
**Grounding:** 32/36 figures traced to tool output; untraced: 1.9, 0.3, 7.8, 5.5

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> **Portland ranks above Bangor because it scores higher on demand pressure and size, which outweigh Bangor's much stronger growth.** The overall gap is 1.9 points (65.1 vs 63.2).
> 
> **Where the points come from** (weighted points, derived from the ranking output)
> 
> | Component (weight) | Portland | Bangor | Difference |
> |---|---|---|---|
> | Demand pressure (30%) | 24.0 | 20.1 | +3.9 for Portland |
> | Congestion (25%) | 19.5 | 19.2 | +0.3 for Portland |
> | Growth outlook (25%) | 12.2 | 20.0 | −7.8 (Bangor leads) |
> | Size of prize (20%) | 9.4 | 3.9 | +5.5 for Portland |
> 
> - **Demand pressure:** Portland's 12-month load factor is 81.7% against Bangor's 79.7%. Its peak-month load factor is 88.9%, against 87.2% for Bangor [T-100].
> - **Size:** Portland handles about 1.3M passengers a year, Bangor about 477k. Size carries 20% of the weight, so this gap matters.
> - **Growth:** Bangor's passengers rose 17.5% year on year, the 99th percentile. Portland's rose 0.7%. This is the main reason Bangor is close behind despite its small base.
> 
> **Assumptions and limits**
> - These gaps use the default weights (demand 30%, congestion 25%, growth 25%, size 20%). A heavier weight on growth would narrow the gap. I have not rerun the scores with different weights, so I cannot say how much weight would reverse the order.
> - Portland's rank held at 2 under the ±20% weight-shift test, so it is the more stable of the two positions. Bangor's rank moved between 3 and 4 in that test, in a tie with Burlington.
> - Congestion for both airports rests on one month of on-time data (July 2025).
> - Portland's growth is near the middle of the national range, so its lead depends mostly on demand and size, not on expansion momentum.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","top_n":10,"weights":{"growth":0.5,"congestion":0.1,"demand_pressure":0.25,"scale":0.15}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1788, cache-read 24522 | **Est. cost:** $0.002  
**Grounding:** 36/37 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **With growth weighted at 50% and congestion at 10%, Bangor moves to first place and Boston drops to second.** Portland falls to third, Burlington holds fourth, and Tweed New Haven moves up to fifth.
> 
> **Changes from the default ranking**
> 
> | Airport | Default rank (score) | Growth-heavy rank (score) |
> |---|---|---|
> | BGR Bangor | 3 (63.2) | 1 (67.4) |
> | BOS Boston Logan | 1 (72.2) | 2 (63.0) |
> | PWM Portland | 2 (65.1) | 3 (59.3) |
> | BTV Burlington | 4 (63.2) | 4 (54.8) |
> | HVN Tweed New Haven | 7 (49.2) | 5 (50.7) |
> | BDL Hartford | 5 (58.2) | 6 (44.2) |
> 
> **Why the order shifts**
> - **Bangor** has the strongest growth in the region: passengers up 17.5% year on year (99th percentile), and a growth score of 80.1. At 50% weight, that growth now carries most of its score.
> - **Boston** loses the most. Its growth score is 46.2, because passengers fell 2.3% and its 10-year forecast growth is only mid-range. Its congestion and size advantages carry less weight now.
> - **Hartford** drops a full place, from 5 to 6, because its growth score is 14.4 and passengers fell 4.3%.
> - **Tweed New Haven** rises to fifth. Its growth score is 52.7, but it has no congestion data, so its score is re-weighted across the other components. Treat its place as provisional.
> 
> **Assumptions and limits**
> - "Much more about growth" is my reading: growth 50%, demand pressure 25%, size 15%, congestion 10%. Other splits would give other orders.
> - The top four held their positions under ±20% shifts to each weight in this run, so the order is more stable than the default run's BGR/BTV tie.
> - Bangor's growth is measured from a small base (477k passengers). Its FAA forecast adds about 103k enplanements by 2035, which ranks at the 21st percentile. A high growth rate on a small base is not the same as a large expansion need.
> - Boston's forecast adds 5.6M enplanements by 2035 (93rd percentile), but that is scored under the size component, which now carries only 15%. Growth-heavy weights understate its absolute forecast volume.
> - Congestion for every airport still rests on one month of on-time data (July 2025). With congestion at 10%, that matters less here.
> - Scores screen where capacity would be absorbed. They do not estimate cost, returns, or whether the terminal is the binding constraint.
> - Scope is unchanged: 65 small New England airports below the 300,000-departing-passenger floor were not scored, so their absence is not a low score.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana airport"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 1603, cache-read 8061 | **Est. cost:** $0.002  
**Grounding:** 27/29 figures traced to tool output; untraced: 90, 0.9

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> On the measures available, LAX and Santa Ana (SNA) have very similar congestion. SNA scores slightly higher on the congestion component (65.9 vs 56.0), but the underlying gaps are small.
> 
> - **Taxi-out time:** LAX averages 17.5 minutes against SNA's 16.4, a difference of about 1.1 minutes (derived). SNA's 90th-percentile taxi-out is slightly longer, at 27 minutes against LAX's 26. [On-Time Performance]
> - **Departure delay:** Average departure delay is 19.0 minutes at LAX and 18.7 at SNA. The share of departures delayed 15+ minutes is 22.9% at LAX and 23.8% at SNA, about 0.9 points apart (derived). [On-Time Performance]
> - **Cancellations:** 1.2% at LAX and 1.4% at SNA. [On-Time Performance]
> - **Delay attribution:** The share of delay attributed to the National Airspace System is 21.3% at LAX and 28.2% at SNA. [On-Time Performance]
> 
> Overall, LAX ranks 17th nationally on the Investment Opportunity Score (69.5) and SNA ranks 43rd (61.9). Most of that gap comes from scale and demand pressure, not congestion. LAX's load factor is 82.2% against SNA's 79.7%, and LAX handles 36.0M passengers against SNA's 5.5M. [T-100]
> 
> **Assumptions and limits**
> - I read "LA" as LAX, the primary airport in the Los Angeles metro, per the resolver. I did not compare Burbank, Long Beach or Ontario, which are also in the metro. Tell me if you want those included.
> - Congestion rests on one month of on-time data (July 2025), so it may reflect one season. The flag is on both airports.
> - On-time data covers large reporting carriers only. Coverage is 72.7% of flights at LAX and 88.8% at SNA, so LAX's congestion figures rest on a smaller share of its traffic.
> - Taxi-out and delay measure ground and departure-flow congestion. They do not measure runway or terminal capacity, so a terminal may not be the binding constraint at either airport.
> - The congestion component is a percentile score relative to peers. The raw differences above are small, so I would not treat SNA as materially more congested than LAX on this evidence.
> - Scores are a screening tool, not a valuation or investment recommendation.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `route_mix({"airport":"ANC"})`  
**Model calls:** 2 | **Tokens:** in 6, out 679, cache-read 3451 | **Est. cost:** $0.001  
**Grounding:** 24/25 figures traced to tool output; untraced: 47.5%

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> About 2.8% of passenger departures from Anchorage (ANC) are long-haul, defined as nonstop segments of 3,000 miles or more. Measured by passengers, the share is 6.1%.
> 
> - **Departures:** 1,100 of 39,532 passenger departures in the 12 months to July 2026 [T-100].
> - **Passengers:** about 169,000 of the airport's passengers flew those long-haul segments [T-100].
> - **Main long-haul routes:** Dallas/Fort Worth (389 departures), Atlanta, Houston, Washington Dulles and Newark. Frankfurt is the only international long-haul destination in the top list, with 30 departures [T-100].
> - **Most traffic is shorter:** 49.7% of departures are under 500 miles, and 47.5% fall between 500 and 2,999 miles [T-100].
> 
> **Assumptions and limits**
> - The 3,000-mile threshold is my choice (the tool default); there is no official definition. The share moves a lot with the cutoff: about 14.5% of departures are 2,000 miles or more, and 19% are 1,500 miles or more.
> - Only passenger and combination flights are counted. Anchorage has more all-cargo departures (47,717) than passenger ones, so the share of all flights would be much lower.
> - Each segment counts as a flight leg, so a connecting passenger is counted on each leg, not on their full trip.
> - Data covers the 12 months to July 2026 [T-100].


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1384, cache-read 3448 | **Est. cost:** $0.001  
**Grounding:** 26/28 figures traced to tool output; untraced: 14.1%, 11.7%

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **Short answer: the data shows only a small, indirect sign of constrained demand at SFO, and no direct measure of unmet flight demand.** The one clear signal is that June 2026 ran above the 85% load-factor rule of thumb. Ground congestion is the stronger signal, and the airport's own notes suggest the terminal may not be what limits flights.
> 
> **Why**
> 
> - **Load factor:** Seats were 82.1% full over the 12 months to July 2026 [T-100]. That is higher than 88% of scored US airports. Only June 2026 (87.1%) exceeded 85%.
> - **Seat shortfall proxy:** Bringing June to 85% would have needed about 70,165 more seats. That is 0.2% of annual seats. The proxy is small.
> - **Demand vs. supply:** Passengers grew 0.6% year over year and seats grew 0.8% [T-100]. Supply is growing at least as fast as demand, so there is no sign that seats are falling behind.
> - **Congestion:** The P90 taxi-out time is 33 minutes, higher than 90% of scored airports. 23.5% of departures were delayed 15+ minutes [On-Time Performance].
> - **Nearby airports:** Oakland (OAK, 11 miles) and San Jose (SJC, 30 miles) have load factors of 74.4% and 73.5%. The tool reads this as consistent with some demand already spilling to them, though both airports' passenger numbers fell over the year (−14.1% and −11.7%), which the tool does not explain.
> - **Binding constraint:** The airport's editorial note says closely spaced parallel runways and fog limit arrivals. A bigger terminal may not raise throughput.
> 
> **Assumptions and limits**
> 
> - "Unmet demand" is not observed. The figures above are proxies: load factor above 85% treated as full, demand growing faster than seats, ground congestion, and spill to nearby airports.
> - The 85% target is a rule-of-thumb assumption. A high load factor does not prove passengers were turned away, since airlines also fill planes through pricing.
> - The congestion figures rest on one month of on-time data (July 2025), so they may reflect one season.
> - The analysis covers the 12 months to July 2026 [T-100].
> - Not covered: fares and yield, denied boarding, waitlists, gate or slot limits, true unconstrained demand (travellers who never booked or chose another mode), and cargo or international origin-destination demand beyond T-100 segments.
> - This is a screening view, not a recommendation or a return estimate.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 375, cache-read 0 | **Est. cost:** $0.001  
**Grounding:** 0/0 figures traced to tool output

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't advise on buying Delta Air Lines stock or any other security. My tools cover US airports, not equity markets or airline share prices, so I have no basis for a view on this week's trade.
> 
> I can help with airport-level questions that might be relevant to your work, such as:
> 
> - **Screening airports for terminal investment:** which US airports score highest on demand pressure, congestion, growth and size, using the Investment Opportunity Score.
> - **Comparing specific airports** on scale, demand and congestion, for example Delta's hubs against other large airports.
> - **Route mix:** the share of departures that are long-haul from a given airport, with the threshold and passenger/cargo scope stated.
> - **Constrained demand:** load-factor and seat-shortfall proxies at an airport, with the caveat that unmet demand cannot be measured directly.
> 
> For a view on Delta's stock, a licensed financial adviser or the company's public filings would be better sources.
