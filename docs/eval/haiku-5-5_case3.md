# Evaluation run

Model: `claude-haiku-5-5`, effort: `medium`. Checks are deterministic (tool use, required mentions, number grounding); they do not judge answer quality, so read the answers.


**Result: 7/7 checks passed. Estimated spend: $0.00.**


## 3. Long-haul share out of Anchorage

### ask: What is the percentage of long haul flights out of Anchorage airport?

**Tools:** `resolve_airports({"query":"Anchorage"})`, `route_mix({"airport":"ANC"})`  
**Model calls:** 3 | **Tokens:** in 8, out 881, cache-read 10984 | **Est. cost:** $0.001  
**Grounding:** 26/26 figures traced to tool output

**Checks:** PASS calls route_mix; PASS mentions /\d+(\.\d+)?\s?%/; PASS mentions /3,?000|miles/i; PASS mentions /cargo/i; PASS mentions /(all|every) (flights|departures)|including cargo|with cargo|cargo (flights )?(included|too)/i; PASS no tool errors; PASS answer not empty

> About 2.8% of passenger departures from Ted Stevens Anchorage International (ANC) are long-haul, defined as 3,000+ statute miles. Long-haul flights carry about 6.1% of passengers. Both figures are for the 12 months to July 2026.
> 
> **Key figures**
> - Long-haul passenger departures: 1,100 of 39,532, or 2.8% [T-100]. This is a derived share from those counts.
> - Long-haul passengers: about 169,000, or 6.1% of ANC passengers [T-100].
> - The largest long-haul routes are Dallas/Fort Worth (389 departures), Atlanta (156), and Houston Intercontinental (129). Frankfurt is the main international long-haul route (30 departures).
> 
> **Assumptions and limits**
> - I used 3,000 miles as the long-haul cutoff. There is no official definition, so the answer moves with the threshold: at 2,000 miles, 14.5% of passenger departures qualify; at 1,500 miles, 19.0% do; at 3,500 miles, 0.3% do [T-100].
> - I counted passenger and combination flights only. ANC also runs many all-cargo flights (47,717 departures). Including them, 29.5% of all departures are long-haul, and 51.6% of cargo departures are [T-100]. The right figure depends on whether cargo matters to your question.
> - Distance is the nonstop segment flown, not the passenger's full journey. A connecting passenger counts on each leg.
> - I resolved "Anchorage airport" to ANC. Merrill Field (MRI) is a general-aviation field with minimal passenger traffic and was not the intended airport.
