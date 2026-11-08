# Evaluation run

Model: `claude-sonnet-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 7/7 checks passed. Estimated spend: $0.01.**


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `route_mix({"airport":"ANC"})`  
**Model calls:** 2 | **Tokens:** in 6, out 645, cache-read 6902 | **Est. cost:** $0.012  
**Grounding:** 27/28 figures traced to tool output; untraced: 43

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS mentions /(all|every) (flights|departures)|including cargo|with cargo|cargo (flights )?(included|too)/i; PASS no tool errors; PASS answer not empty

> **About 2.8% of passenger departures from Anchorage (ANC) are long-haul.** That is 1,100 of 39,532 departures in the 12 months to July 2026 [T-100]. By passengers carried, the share is 6.1%.
> 
> **Cargo changes the answer a lot.** ANC has more all-cargo departures (47,717) than passenger departures.
> - Passenger flights only: 2.8% long-haul.
> - All-cargo flights only: 51.6% long-haul.
> - All flights combined: 29.5% long-haul.
> 
> **The result depends on the threshold.** The share of passenger departures that count as long-haul at each cutoff:
> - 1,500+ miles: 19.0%
> - 2,000+ miles: 14.5%
> - 2,500+ miles: 9.7%
> - 3,000+ miles: 2.8%
> - 3,500+ miles: 0.3%
> 
> Most long-haul passenger flights are to US hubs just past 3,000 miles. Dallas/Fort Worth is the largest at 389 departures and 3,043 miles. Atlanta, Houston, Washington Dulles, Newark and New York JFK follow. Frankfurt (30 departures) and Hong Kong (14) are the only international destinations among the top long-haul routes. International flights are 0.7% of all passenger departures.
> 
> **Assumptions and limits**
> - Long-haul means a nonstop segment of 3,000 or more statute miles. There is no official definition.
> - The default scope is passenger and combination flights, counting departures from ANC only.
> - Distance is the single nonstop leg, not the passenger's full trip. A connecting passenger counts on each leg.
> - Because DFW sits only 43 miles above the cutoff, the 2.8% would move sharply with a slightly different threshold.
