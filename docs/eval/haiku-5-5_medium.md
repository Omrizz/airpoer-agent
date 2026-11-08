# Evaluation run

Model: `claude-haiku-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 35/35 checks passed. Estimated spend: $0.01.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England","top_n":10})`  
**Model calls:** 2 | **Tokens:** in 6, out 1954, cache-read 6900 | **Est. cost:** $0.002  
**Grounding:** 48/49 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest New England candidate, scoring 72.2. Portland (PWM), Bangor (BGR), Burlington (BTV) and Bradley (BDL) follow, and the top five holds under ±20% weight changes.** This is a screening score, not a recommendation or a return estimate.
> 
> | Rank (national) | Airport | Score | LTM passengers | Main signal |
> |---|---|---|---|---|
> | 1 (11) | BOS | 72.2 | 20.9M | Scale; 5.6M forecast added enplanements by 2035 (93rd pct) |
> | 2 (36) | PWM | 65.1 | 1.3M | Peak-month load factor 88.9% (93rd pct) |
> | 3 (38) | BGR | 63.2 | 477k | Passenger growth 17.5% year on year (99th pct) |
> | 4 (39) | BTV | 63.2 | 701k | Passengers growing 3.8 points slower than seats (97th pct) |
> | 5 (56) | BDL | 58.2 | 3.2M | Load factor 81.4%; passengers down 4.3% year on year |
> 
> Sources: [T-100], [FAA TAF], [On-Time Performance].
> 
> **What drives the ranking**
> - **BOS** scores on size and congestion: P90 taxi-out of 35.0 minutes (93rd pct) and 31.4% of delay minutes from air-system volume (95th pct). Its passenger count fell 2.3% year on year, so growth is weak.
> - **PWM** scores on demand pressure. Its 12-month load factor is 81.7%, but it is small, with a 278k forecast addition.
> - **BGR** and **BTV** are effectively tied at 63.2. BGR's growth is high from a small base. BTV's signal is a seat-versus-passenger gap, and it has the longest taxi-out time in the group at 36.4 minutes.
> - **BDL** is the largest of the group after BOS, with a 523k forecast addition, but its passenger count is falling.
> 
> **Assumptions and limits**
> - Default weights: demand pressure 30%, congestion 25%, growth 25%, size 20%. Percentiles are national, among 179 airports with at least 300,000 departing passengers a year.
> - Congestion rests on one month of on-time data (July 2025), so it may reflect a summer peak.
> - Taxi-out and delay are proxies for congestion, not measures of runway capacity.
> - Adjacent ranks are close: BGR and BTV are tied, and the sensitivity check puts BGR at rank 3 or 4.
> - Terminal space may not be the binding constraint at some airports. The tool does not test this, and I have not estimated construction cost or returns.
> - Tweed New Haven (HVN) ranks 7th nationally 94th with a score of 49.2, but its confidence is low because it has no congestion data.
> 
> **Scope**
> - Ranked: 8 New England airports with enough traffic to be scored.
> - Not scored: 65 airports in the region below the traffic floor, mostly very small or seasonal. Not being scored means they were not assessed, not that they scored low.
> - Data window: the 12 months to July 2026 for traffic, with the FAA forecast for 2025 onward.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1394, cache-read 9485 | **Est. cost:** $0.001  
**Grounding:** 33/37 figures traced to tool output; untraced: 1.9, 7.8, 5.5

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> **Portland ranks above Bangor because it has stronger demand pressure and scale, while Bangor's faster growth doesn't fully offset that. The gap is small: 65.1 versus 63.2, or 1.9 points.** [Derived from the ranking output.]
> 
> **Where the 1.9 points come from** (component points, out of each component's weight):
> - **Demand pressure:** Portland 24.0, Bangor 20.1. Portland adds 3.9. Its 12-month load factor is 81.7% against Bangor's 79.7%, and its peak-month load factor is 88.9% against 87.2% [On-Time Performance / T-100].
> - **Congestion:** Portland 19.5, Bangor 19.2. Nearly even. Bangor's taxi-out is longer (31.0 vs 27.0 minutes at P90), but its share of delay minutes from air-system volume is much higher (45.0% vs 26.5%), and the two offset.
> - **Growth:** Portland 12.2, Bangor 20.0. Bangor wins this by 7.8. Its passengers grew 17.5% year on year against Portland's 0.7%, and its forecast adds 103k enplanements against Portland's 278k.
> - **Scale:** Portland 9.4, Bangor 3.9. Portland adds 5.5. It has 1.3M passengers over the 12 months to July 2026 against Bangor's 477k.
> 
> Portland's advantage in demand and scale outweighs Bangor's growth lead. Bangor's growth comes from a much smaller base.
> 
> **Assumptions and limits**
> - These results use the default weights (demand pressure 30%, congestion 25%, growth 25%, scale 20%). A heavier weight on growth would narrow or reverse the gap. I have not tested that, because a rerun would be needed to say where it flips.
> - The sensitivity check shows Portland staying at rank 2 when each weight is shifted by ±20%. Bangor moves between ranks 3 and 4, tied with Burlington.
> - Congestion uses one month of on-time data (July 2025), so the congestion comparison may reflect summer conditions only.
> - The score measures screening attractiveness for added terminal capacity. It does not show that Portland's terminal is more constrained than Bangor's, and it does not estimate cost or returns.
> 
> If you want to see how the order changes when growth matters more, I can rerun the ranking with a different weighting.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","top_n":10,"weights":{"growth":0.45,"congestion":0.1,"demand_pressure":0.3,"scale":0.15}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1809, cache-read 24050 | **Est. cost:** $0.002  
**Grounding:** 27/28 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **With growth weighted at 45% and congestion at 10%, Bangor moves to first place (66.8), Boston drops to second (64.3), and Portland falls to third (60.9).** I set these weights to match "much more growth than congestion." Demand pressure stays at 30% and scale drops to 15%. [Derived from the re-weighted ranking.]
> 
> **What changes**
> - **Bangor (BGR)** rises from 3rd to 1st. Its score goes from 63.2 to 66.8, and its growth component contributes 36.1 points. Its passengers grew 17.5% year on year.
> - **Boston (BOS)** falls from 1st to 2nd. Its score goes from 72.2 to 64.3. Its growth component is only 46.2 out of 100, and its passengers fell 2.3%. Its lead rested on scale and congestion, which now count for less.
> - **Portland (PWM)** falls from 2nd to 3rd. Its score goes from 65.1 to 60.9, because its growth score is 48.9 and it grew only 0.7%.
> - **Burlington (BTV)** holds 4th, at 57.2.
> - **Tweed New Haven (HVN)** enters the top five at 5th, with a score of 51.0. Its confidence is low, and it has no congestion data, so its score is re-weighted over the other components.
> - **Bradley (BDL)** drops from 5th to 6th, because its growth score is only 14.4.
> 
> **Assumptions and limits**
> - Bangor's and Boston's growth scores are on different bases. Bangor's rise comes from a 477k-passenger airport growing fast, while Boston is 20.9M passengers and shrinking. In absolute terms, Boston's passenger volume is far larger.
> - Bangor and Boston are effectively tied under this weighting. Under ±20% shifts, each could be 1st or 2nd. Portland holds 3rd, and Burlington holds 4th, under the same shifts.
> - Congestion still rests on one month of on-time data (July 2025), so the reduced congestion weight matters less here, but the data remains thin.
> - Tweed New Haven's position depends on a re-weighted score with no congestion input, so treat its 5th place as low confidence.
> - The score measures screening attractiveness for added capacity. It does not show that the terminal is the binding constraint at Bangor or anywhere else, and it does not estimate cost or returns.
> 
> **Scope**
> - Ranked: 8 New England airports with enough traffic to be scored.
> - Not scored: 65 airports in the region that fall below the traffic floor. This is not a low score.
> - Data window: the 12 months to July 2026 for traffic.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 1543, cache-read 11510 | **Est. cost:** $0.001  
**Grounding:** 22/25 figures traced to tool output; untraced: 90, 253,000, 51,000

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> **Short answer:** On the congestion measures available, LAX and SNA are close to a tie. LAX has slightly longer taxi-out times and a much larger total delay burden. SNA has a slightly higher congestion score, mainly because a slightly larger share of its departures were delayed 15+ minutes. None of the gaps is large.
> 
> **What drives it**
> 
> - **Taxi-out:** LAX averages 17.5 minutes against 16.4 at SNA. The 90th percentile is 26 minutes at LAX and 27 at SNA. [On-Time Performance]
> - **Delays:** Average departure delay is 19.0 minutes at LAX and 18.7 at SNA. Departures delayed 15+ minutes are 22.9% at LAX and 23.8% at SNA. [On-Time Performance]
> - **Congestion score:** SNA scores 65.9 and LAX 56.0 on the congestion component (0–100, a percentile score against the scoring peer set). This follows from the small delay-share difference, not from a large gap in minutes.
> - **Scale:** LAX had about 253,000 passenger departures in the last 12 months against about 51,000 at SNA. Per flight the two are comparable, but LAX's total delay burden is roughly five times larger. [T-100]
> - **Context:** Load factor is 82.2% at LAX (peak month 88.1%) and 79.7% at SNA (peak month 82.9%). [T-100]
> 
> **Assumptions and limits**
> 
> - I took "LA" to mean LAX, the primary airport. Burbank (BUR), Long Beach (LGB) and Ontario (ONT) are nearby alternatives and were not compared. Tell me if you want them included.
> - Congestion rests on one month of on-time data (July 2025), so it may reflect one season. This is the main caveat.
> - On-time data covers large reporting carriers only. Coverage is 72.7% of sampled flights at LAX and 88.8% at SNA, so smaller-carrier delays are missing, more so at LAX.
> - Taxi-out and delay measure ground and departure-flow congestion. They are not runway or terminal capacity, so a terminal may not be the binding constraint at either airport.
> - Scores are a screening tool, not a recommendation to invest.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `resolve_airports({"query":"Anchorage"})`, `route_mix({"airport":"ANC"})`  
**Model calls:** 3 | **Tokens:** in 8, out 1055, cache-read 10972 | **Est. cost:** $0.001  
**Grounding:** 26/26 figures traced to tool output

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS no tool errors; PASS answer not empty

> About 2.8% of passenger departures from Ted Stevens Anchorage International (ANC) were long-haul in the 12 months to July 2026. Measured by passengers, the share is 6.1%.
> 
> **Key figures**
> - Long-haul passenger departures: 1,100 of 39,532 [T-100].
> - Long-haul passengers: 169,043 (6.1% of passengers) [T-100].
> - Most long-haul departures go to Dallas/Fort Worth (389), then Atlanta (156) and Houston (129). The largest long-haul flight by passengers is DFW, at about 3,043 miles [T-100].
> - Nearly half of departures (49.7%) are under 500 miles, so the network is mostly short regional flying.
> 
> **Sensitivity to the threshold**
> - At 2,500 miles: 9.7% of departures, 20.9% of passengers.
> - At 3,500 miles: 0.3% of departures, 0.4% of passengers.
> 
> **Assumptions and limits**
> - Long-haul is defined as a nonstop segment of 3,000+ statute miles. There is no official definition.
> - Scope is passenger and combination flights only, departures from ANC, over the 12 months from August 2025 to July 2026.
> - Cargo is excluded. ANC has more all-cargo departures (47,717) than passenger departures (39,532), so the all-flights share would be lower. I did not calculate it; I can run the all-service view if you want it.
> - Each connecting passenger is counted on every leg, and distance is the leg flown, not the full trip.
> - I matched "Anchorage" to ANC by passenger volume. Merrill Field (MRI) and Elmendorf AFB (EDF) also match the name but are not commercial airports of note here.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 961, cache-read 6896 | **Est. cost:** $0.001  
**Grounding:** 23/23 figures traced to tool output

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|cannot be measured|not directly/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> SFO shows signs of constrained demand, but the evidence is thin. Only one month (June 2026) ran above the 85% load-factor rule of thumb, and the tool cannot measure unmet demand directly. The main constraint may be runway and airspace capacity rather than terminal space.
> 
> **Proxies from the 12 months to July 2026 [T-100, On-Time Performance]:**
> 
> - **Load factor:** 82.1% on average, which the tool says is higher than 88% of scored US airports. Peak month was June 2026 at 87.1%, the only month above 85%.
> - **Seat shortfall proxy:** about 70,165 seats would have been needed to keep every month at or below 85%. That is 0.2% of annual seats, and it comes entirely from June. This is a modelled figure, not a count of turned-away passengers.
> - **Demand versus supply:** passengers grew 0.6% year on year and seats grew 0.8%, so supply is keeping pace with demand.
> - **Spill to nearby airports:** Oakland (OAK, 11 miles) ran at 74.4% load factor and San Jose (SJC, 30 miles) at 73.5%. Both lower than SFO, which is consistent with some demand going elsewhere, though it does not prove it.
> - **Ground congestion:** the 90th-percentile taxi-out time is 33 minutes, higher than 90% of scored airports, and 23.5% of departures were delayed 15+ minutes.
> 
> **Why the terminal may not be the binding constraint:** the tool's editorial note says closely spaced parallel runways and fog limit arrivals, so a bigger terminal may not raise throughput. The congestion figures point the same way.
> 
> **Assumptions and limits:**
> 
> - The 85% "full" threshold is a rule of thumb, not a measured capacity limit. Airlines also fill planes through pricing, so high load factors do not prove customers were turned away.
> - The congestion figures rest on one month of on-time data (July 2025), so they may reflect one season.
> - Not measurable here: true unconstrained demand, fares and yield, denied boarding, waitlists, gate or slot limits, and cargo or international origin-destination demand beyond the T-100 segments.
> - This is a screening proxy, not a forecast or investment case. It says nothing about returns.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 434, cache-read 3447 | **Est. cost:** $0.000  
**Grounding:** 0/0 figures traced to tool output

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't advise on buying Delta Air Lines stock. I don't model share prices, company valuation, or returns, and this tool doesn't cover airline equities.
> 
> I can help with the airport side of the question. For example, I can:
> 
> - **Screen airports for terminal expansion** by ranking US airports on demand pressure, congestion, growth outlook, and size of prize.
> - **Compare specific airports** on scale, load factor, growth, and taxi-out and delay times. Delta's hub airports, such as Atlanta, Detroit, Minneapolis-St. Paul, or Salt Lake City, would be natural candidates.
> - **Look at constrained demand** at a given airport, using load-factor and seat-growth proxies and nearby alternatives. Unmet demand can't be measured directly, so these are indicators only.
> - **Break down route mix** at an airport, such as the share of flights that are long-haul.
> 
> For a view on Delta stock, you'd want a financial adviser or equity research that covers the company's finances, fuel costs, labour agreements, and valuation.
