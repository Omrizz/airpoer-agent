# Evaluation run

Model: `claude-sonnet-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 36/36 checks passed. Estimated spend: $0.18.**


## 1. New England terminal-expansion candidates (+ follow-ups)

### ask: Which airports in New England are strong candidates for terminal expansion?

**Tools:** `rank_airports({"region":"New England"})`  
**Model calls:** 2 | **Tokens:** in 6, out 1096, cache-read 4634 | **Est. cost:** $0.038  
**Grounding:** 42/42 figures traced to tool output

**Checks:** PASS calls rank_airports; PASS mentions /BOS|Boston/i; PASS mentions /not (been )?scored|below|small|Nantucket/i; PASS mentions /one month|single|season|assum|proxy/i; PASS no tool errors; PASS answer not empty

> **Boston Logan (BOS) is the strongest New England candidate, scoring 72.5. Bangor (BGR, 65.0), Burlington (BTV, 61.4) and Portland, ME (PWM, 60.5) follow.** Bradley (BDL, 52.7) is fifth. The top five kept their order when each weight was shifted by ±20%. Scores are a screen, not a valuation or an investment recommendation.
> 
> **Why they rank where they do** (12 months to July 2026)
> - **BOS:** It has the largest scale and congestion signals. It handles 20.9M passengers [T-100]. The FAA forecasts 5.6M added enplanements by 2035 (93rd national percentile) [TAF]. Its P90 taxi-out is 33 minutes and its load factor is 81.3%. Passenger growth is weak at -2.3% year on year.
> - **BGR:** Growth drives its score. Passengers rose 17.5% year on year (99th percentile). It is small, at 477k passengers and 103k forecast added enplanements, so its size-of-prize score is low (19.6).
> - **BTV:** It has the highest demand pressure of the group (87.2). Its peak-month load factor is 88.1%. Passengers are growing faster than seats (+3.8%), which suggests capacity is tight. Its P90 taxi-out is 41 minutes, in the 97th percentile. Passenger growth is slightly negative (-1.8%).
> - **PWM:** It is full at peak, with a peak-month load factor of 88.9% (93rd percentile) and 81.7% overall. Congestion is moderate and growth is flat (+0.7%).
> - **BDL:** Demand pressure is high, with an 81.4% load factor. Growth is its weak spot. Passengers fell 4.3% and its 10-year FAA forecast growth rate is low.
> 
> Further down are PVD (48.8) and MHT (35.0). HVN (49.2) is also scored but low-confidence (see below).
> 
> **Assumptions and limits**
> - **Weights:** Default weights are demand pressure 30%, congestion 25%, growth 25% and size of prize 20%. Percentiles are national, among 179 airports with at least 300k departing passengers a year.
> - **Congestion proxies:** Congestion is measured by taxi-out time and delay shares. These are proxies, not measures of runway capacity. Congestion comes from on-time data for only six sampled months, so it may reflect seasonal patterns.
> - **HVN:** New Haven (49.2) has no congestion data. Its score was re-weighted over the other components and confidence is low. Treat its rank as indicative only.
> - **Not scored:** 65 New England airports were not scored. Examples are Nantucket, Worcester and Martha's Vineyard, which fall below the traffic floor. Not being scored doesn't mean they scored low.
> - **Not modelled:** The screen doesn't estimate construction cost, returns, or whether the terminal is the binding constraint rather than airfield, airline capacity or ground access. I can run `demand_gap` or `estimate_upside` on any of these if you want more depth.

### follow-up (explain): Why is Portland ranked above Bangor?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 1272, cache-read 10326 | **Est. cost:** $0.017  
**Grounding:** 34/41 figures traced to tool output; untraced: 4.5, 31.2, 13.0, 27.3, 7.8, 5.5, 4.4

**Checks:** PASS mentions /Portland|PWM/i; PASS mentions /Bangor|BGR/i; PASS no tool errors; PASS answer not empty

> Portland isn't ranked above Bangor. Bangor is 2nd (65.0) and Portland is 4th (60.5), a gap of about 4.5 points. Burlington (61.4) sits between them.
> 
> Here is how the four components compare, using the figures from the ranking already run:
> 
> | Component (weight) | BGR | PWM | Which is higher |
> |---|---|---|---|
> | Growth (25%) | 80.1 | 48.9 | BGR by 31.2 |
> | Congestion (25%) | 83.7 | 59.7 | BGR by 24.0 |
> | Demand pressure (30%) | 67.1 | 80.1 | PWM by 13.0 |
> | Size of prize (20%) | 19.6 | 46.9 | PWM by 27.3 |
> 
> - **Growth:** Bangor's passengers grew 17.5% year on year (99th percentile). Portland's grew 0.7%.
> - **Congestion:** Bangor's P90 taxi-out is 33 minutes, against 29 for Portland. Bangor also has more departures delayed 15+ minutes (22.5% vs 18.5%).
> - **Demand pressure:** Portland is fuller. Its load factor is 81.7% against 79.7%, and its peak month is 88.9% against 87.2%.
> - **Size of prize:** Portland is larger. It handles 1.3M passengers against 477k, and the FAA forecasts 278k added enplanements against 103k.
> 
> In weighted points, Bangor gains about 7.8 from growth and 6.0 from congestion. Portland gains about 3.9 from demand pressure and 5.5 from scale. The net is roughly 4.4 points for Bangor (derived from the rounded component points).
> 
> **Assumptions and limits**
> - Bangor's lead rests mainly on one year of strong growth and on congestion measured over six sampled months. A small airport's figures can swing on a few flights or one season, so the growth surge may not persist.
> - Portland is the larger and fuller airport. An investor who cares more about scale or peak-period fullness could reasonably prefer it. I haven't re-run the ranking with different weights. I can do that if you want to see whether the order flips.
> - The ±20% weight sensitivity test kept the top five in the same order. Heavier re-weighting is untested.
> - Both airports scored with high confidence. This is a screen, not a valuation. It doesn't show whether the terminal is the binding constraint.

### follow-up (re-weight): What changes if we care much more about growth than congestion?

**Tools:** `rank_airports({"region":"New England","weights":{"growth":0.45,"congestion":0.1,"demand_pressure":0.25,"scale":0.2}})`  
**Model calls:** 2 | **Tokens:** in 6, out 1060, cache-read 24070 | **Est. cost:** $0.033  
**Grounding:** 39/40 figures traced to tool output; untraced: 2.3%

**Checks:** PASS calls rank_airports; PASS no tool errors; PASS answer not empty

> **Emphasising growth narrows the gap at the top but doesn't change the leader. BOS (65.4) and BGR (65.1) are now effectively tied for first.** I re-ran the ranking with growth at 45% (was 25%), congestion at 10% (was 25%), demand pressure at 25% and scale at 20%. That is my interpretation of "much more growth than congestion".
> 
> **What moved**
> 
> | Rank | Default weights | Growth-heavy weights |
> |---|---|---|
> | 1 | BOS 72.5 | BOS 65.4 |
> | 2 | BGR 65.0 | BGR 65.1 |
> | 3 | BTV 61.4 | PWM 57.4 |
> | 4 | PWM 60.5 | BTV 53.8 |
> | 5 | BDL 52.7 | HVN 49.4 (low confidence) |
> | 6 | HVN 49.2 | BDL 44.6 |
> | 7–8 | PVD, MHT | PVD, MHT (unchanged) |
> 
> - **BOS:** Its score drops by about 7 points because congestion was one of its strengths (84.7). Its growth score is middling (46.2), and passengers fell 2.3% year on year. The FAA forecast of 5.6M added enplanements and its scale keep it first.
> - **BGR:** It is almost level with BOS. Its growth score of 80.1 (passengers up 17.5%) carries more weight. The sensitivity test shows BOS and BGR can swap places within ±20% weight shifts, so treat them as tied.
> - **PWM overtakes BTV:** BTV's strengths are congestion (41-minute P90 taxi-out) and seats lagging passengers, not growth. Its growth score is 39.6, against 48.9 for PWM.
> - **BDL falls to 6th:** Its growth score is the lowest in the region (14.4), with passengers down 4.3%. HVN rises to 5th on a growth score of 52.7.
> - **PVD and MHT** stay at the bottom.
> 
> **Assumptions and limits**
> - **Growth measure:** The growth component mixes recent passenger growth with FAA forecast growth. Bangor's high score leans on one 12-month surge (17.5%). That may not last, and Bangor's forecast growth is only mid-range (2.2% a year, 61st percentile).
> - **HVN:** Its fifth place is low-confidence. It has no congestion data, so its score was re-weighted over the other components, and growth carries 50% of it.
> - **Stability:** The top five kept its membership under ±20% weight shifts around these new weights. Only the order of the top two is unsettled.
> - **Scope:** 65 smaller airports were not scored, and the screen doesn't estimate cost, returns or whether the terminal is the binding constraint.
> 
> I can try other weightings if you want to test where the order changes.


## 2. LA vs Santa Ana congestion

### ask: Compare LA and Santa Ana airport congestion levels.

**Tools:** `resolve_airports({"query":"LA"})`, `resolve_airports({"query":"Santa Ana"})`, `compare_airports({"airports":["LAX","SNA"]})`  
**Model calls:** 3 | **Tokens:** in 8, out 876, cache-read 10362 | **Est. cost:** $0.030  
**Grounding:** 23/25 figures traced to tool output; untraced: 90, 1.7

**Checks:** PASS calls compare_airports; PASS mentions /LAX/i; PASS mentions /SNA|John Wayne|Santa Ana/i; PASS mentions /taxi|delay/i; PASS no tool errors; PASS answer not empty

> **LAX is slightly more congested than Santa Ana (SNA), but the gap is small.** Their congestion scores are effectively tied: 54.1 for LAX and 53.9 for SNA, on a 0–100 percentile scale.
> 
> **Per-flight measures (LAX vs SNA)** [On-Time Performance]
> - Average taxi-out: 17.8 min vs 16.1 min.
> - 90th-percentile taxi-out: 27 vs 26 min.
> - Average departure delay: 14.8 vs 14.1 min.
> - Departures delayed 15+ min: 19.3% vs 18.8%.
> - Cancellations: 1.2% vs 1.3%. SNA is slightly higher here.
> - Share of delay attributed to the national airspace system: 22.4% vs 29.0%.
> 
> LAX is worse on every delay and taxi measure, but only by small margins. The 1.7-minute taxi-out gap is the largest difference.
> 
> **Scale:** LAX handles about 36.0M passengers a year and SNA about 5.5M [T-100]. LAX is about 6.5 times larger, so its total delay burden is much bigger even though per-flight delays are similar.
> 
> **Assumptions and limits**
> - I took "LA" to mean LAX, the main Los Angeles airport. "LA" could also mean Louisiana. Burbank, Long Beach and Ontario are also in the LA area, and I didn't compare them.
> - Congestion rests on six sampled months of on-time data: Jul, Sep and Nov 2025, and Jan, Mar and May 2026. It is not a full year, so seasonal peaks may be missed.
> - On-time data covers large reporting carriers only. Coverage is 74.6% of LAX flights and 88.8% of SNA flights, so LAX's picture is less complete.
> - Taxi-out and delay show ground and departure-flow congestion. They don't show runway or terminal capacity.
> - Passenger volumes are for the 12 months to July 2026.
> - This is a screening comparison, not an investment recommendation.


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `route_mix({"airport":"ANC"})`  
**Model calls:** 2 | **Tokens:** in 6, out 707, cache-read 4635 | **Est. cost:** $0.024  
**Grounding:** 31/32 figures traced to tool output; untraced: 1,499

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS mentions /(all|every) (flights|departures)|including cargo|with cargo|cargo (flights )?(included|too)/i; PASS no tool errors; PASS answer not empty

> **About 2.8% of passenger flights out of Anchorage (ANC) are long-haul.** That is 1,100 of 39,532 departures in the 12 months to July 2026 [T-100]. Long-haul flights carry a larger share of passengers, 6.1% (169,043 passengers).
> 
> **Cargo changes the answer a lot.** ANC has more all-cargo departures (47,717) than passenger departures. Using the same 3,000-mile cut-off:
> - Passenger flights: 2.8%
> - All-cargo flights: 51.6%
> - All flights combined: 29.5%
> 
> **Why the passenger share is low:** Most passenger departures are short. 49.7% go under 500 miles and 31.3% go 500–1,499 miles. The main long-haul destinations are Dallas/Fort Worth (389 departures), Atlanta (156), Houston (129), Washington Dulles (110) and Newark (101). Frankfurt and Hong Kong are also on the list, but with few departures.
> 
> **Assumptions and limits**
> - **Definition:** Long-haul means a nonstop leg of 3,000 or more statute miles. There is no official definition. The result depends heavily on the cut-off:
> 
> | Cut-off | Share of passenger departures |
> |---|---|
> | 1,500+ miles | 19.0% |
> | 2,000+ miles | 14.5% |
> | 2,500+ miles | 9.7% |
> | 3,500+ miles | 0.3% |
> 
> - **Scope:** The figures count passenger and combination flights departing ANC, unless I say otherwise. They exclude flights from other airports.
> - **Distance:** The distance is the single nonstop leg, not the passenger's full trip. A connecting passenger counts on each leg.
> - **Borderline routes:** Dallas/Fort Worth is 3,043 miles away, just over the cut-off. It is the largest long-haul route, so a slightly higher cut-off would remove a large part of the 2.8%.


## 4. Unmet demand at SFO

### ask: What is the unmet flight demand in SFO airport and why?

**Tools:** `demand_gap({"airport":"SFO"})`  
**Model calls:** 2 | **Tokens:** in 6, out 892, cache-read 4632 | **Est. cost:** $0.026  
**Grounding:** 20/23 figures traced to tool output; untraced: 70,000, 14.1%, 11.7%

**Checks:** PASS calls demand_gap; PASS mentions /proxy|proxies|(cannot|can't|can not) be (measured|observed)|not (directly )?(measurable|observable|measured)|measured directly|indirect/i; PASS mentions /OAK|Oakland|SJC|San Jose/i; PASS mentions /runway|fog|editorial|terminal/i; PASS no tool errors; PASS answer not empty

> **Short answer:** Unmet demand at SFO can't be measured directly. The proxies point to modest, localized pressure, not a large unserved market. Ground congestion looks like a bigger constraint than demand.
> 
> **Proxies (12 months to July 2026)**
> - **Load factor:** Seats were 82.1% full on average [T-100]. That is higher than 88% of scored US airports. Only 1 of 12 months went above the 85% "full" mark. That month was June 2026, at 87.1%.
> - **Seat shortfall:** About 70,000 extra seats would have kept every month at or below 85%. That is roughly 0.2% of annual seats, so it is small.
> - **Growth:** Passengers grew 0.6% year over year and seats grew 0.8%. Supply is keeping pace with demand, so demand is not outrunning capacity.
> - **Spill to nearby airports:** OAK (74.4% load factor) and SJC (73.5%) have much emptier planes. That is consistent with some demand already going elsewhere, though the data doesn't prove it. Both airports also lost passengers over the year (OAK down 14.1%, SJC down 11.7%).
> - **Ground congestion:** P90 taxi-out is 33 minutes, higher than at 84% of scored airports. 21.2% of departures were delayed 15+ minutes [On-Time Performance].
> 
> **Why it looks this way**
> Demand is high but not overflowing. Planes are fairly full, but airlines have kept adding seats. Delays and taxi times are high. SFO also carries a note that closely spaced parallel runways and fog limit arrivals, so a bigger terminal may not raise throughput. In that case the runways, not the terminal, are the binding constraint.
> 
> **Assumptions and limits**
> - The 85% "full" threshold is a rule of thumb. A load factor above it doesn't prove passengers were turned away, because airlines also fill planes by raising prices.
> - The on-time data covers only six sampled months (Jul, Sep, Nov 2025 and Jan, Mar, May 2026) and only reporting carriers.
> - The data cannot show:
>   - travelers who never booked or chose another mode;
>   - fares and yield;
>   - denied boardings, waitlists, or gate and slot limits;
>   - international or cargo demand beyond what appears in T-100 segments.
> - This is a screening view, not a valuation or an investment recommendation.
> 
> If it would help, I can compare SFO with OAK and SJC, or run a different "full" threshold such as 80%.


## 5. Boundary: out of scope

### ask: Should I buy Delta Air Lines stock this week?

**Tools:** none  
**Model calls:** 1 | **Tokens:** in 4, out 372, cache-read 0 | **Est. cost:** $0.015  
**Grounding:** 0/0 figures traced to tool output

**Checks:** PASS calls no tools; PASS mentions /can't|cannot|outside|not (able|something)|don't|do not/i; PASS no tool errors; PASS answer not empty

> I can't help with that one. Stock picks and trading timing for Delta, or any other company, are outside what I do. I only work on US airport screening, and I don't use any data on airline equities or share prices.
> 
> Here is what I can do on the airport side:
> 
> - **Rank airports** as candidates for terminal expansion or renovation. This uses demand pressure, congestion, growth outlook and scale, and I can do it nationally or for a state or region.
> - **Compare airports** side by side on demand and congestion. If you're looking at Delta's hubs, for example, I can compare Atlanta, Detroit, Minneapolis and others as airports.
> - **Look at constrained demand** at a specific airport. This uses proxies such as load factors and seat shortfalls, not a direct measure.
> - **Show route mix**, such as the share of long-haul flights from an airport.
> - **Run illustrative expansion economics** for an airport. These are assumption-driven scenarios, not forecasts.
> - **Check live FAA status** for ground stops and delay programs.
> 
> These are screening tools, not investment advice. If you'd like, tell me an airport or region and I'll start there.
