import onnxruntime as ort
import numpy as np

acc_sess = ort.InferenceSession('backend/ml/models/acceptance_model.onnx')
del_sess = ort.InferenceSession('backend/ml/models/delivery_model.onnx')

scenarios = [
    # 1. Chennai -> Coimbatore (Return: Chennai) - High Overlap
    {
        "id": 1,
        "driver": "Ramesh (Mini Truck)",
        "trip": "Coimbatore to Chennai (Return to Coimbatore)",
        "return_dest": "Coimbatore (11.0168, 76.9558)",
        "flex": "BALANCED (30km)",
        "candidate": "Auto Parts (Chennai -> Tiruppur)",
        "distances": "Pickup: 5km, Detour: 12km, Direct Return: 500km",
        "vec": [0.98, 12.0, 0.85, 0.95, 1.0, 13.0827, 80.2707, 11.0168, 76.9558, 13.0100, 80.2000, 11.1075, 77.3411, 4.8],
        "explanation": "High return alignment (Chennai to Tiruppur is 90% along Coimbatore return route). Low detour distance (12km). Excellent capacity utilization."
    },
    # 2. Chennai -> Salem (Return: Chennai) - Perfect Alignment
    {
        "id": 2,
        "driver": "Kannan (Pickup)",
        "trip": "Salem to Chennai (Return to Salem)",
        "return_dest": "Salem (11.6643, 78.1460)",
        "flex": "STRICT (10km)",
        "candidate": "Textiles (Chennai -> Erode)",
        "distances": "Pickup: 3km, Detour: 8km, Direct Return: 340km",
        "vec": [0.97, 8.0, 0.90, 0.98, 2.0, 13.0827, 80.2707, 11.6643, 78.1460, 13.0500, 80.2200, 11.3410, 77.7172, 5.0],
        "explanation": "Erode lies directly on the NH44 highway back to Salem. Virtually zero detour, high customer trust score."
    },
    # 3. Madurai -> Trichy (Return: Madurai) - Medium Detour
    {
        "id": 3,
        "driver": "Murugan (Truck)",
        "trip": "Trichy to Madurai (Return to Trichy)",
        "return_dest": "Trichy (10.7905, 78.7047)",
        "flex": "FLEXIBLE (70km)",
        "candidate": "Agricultural Machinery (Madurai -> Dindigul)",
        "distances": "Pickup: 15km, Detour: 42km, Direct Return: 135km",
        "vec": [0.69, 42.0, 0.70, 0.85, 0.0, 9.9252, 78.1198, 10.7905, 78.7047, 9.9500, 78.1500, 10.3673, 77.9803, 4.2],
        "explanation": "Dindigul requires a 42km western deviation off the direct Trichy highway. Acceptable under Flexible mode, medium ranking score."
    },
    # 4. Coimbatore -> Hosur (Return: Coimbatore) - High Overlap
    {
        "id": 4,
        "driver": "Senthil (Tempo)",
        "trip": "Hosur to Coimbatore (Return to Hosur)",
        "return_dest": "Hosur (12.7409, 77.8253)",
        "flex": "BALANCED (30km)",
        "candidate": "Electronics (Coimbatore -> Salem)",
        "distances": "Pickup: 4km, Detour: 6km, Direct Return: 375km",
        "vec": [0.98, 6.0, 0.80, 0.90, 3.0, 11.0168, 76.9558, 12.7409, 77.8253, 11.0300, 76.9700, 11.6643, 78.1460, 4.6],
        "explanation": "Salem is midway on the return journey from Coimbatore to Hosur. Outstanding spatial alignment."
    },
    # 5. Tiruppur -> Chennai (Return: Tiruppur) - Zero Overlap Opposite Direction
    {
        "id": 5,
        "driver": "Prakash (Van)",
        "trip": "Chennai to Tiruppur (Return to Chennai)",
        "return_dest": "Chennai (13.0827, 80.2707)",
        "flex": "STRICT (10km)",
        "candidate": "Garments (Tiruppur -> Nagercoil)",
        "distances": "Pickup: 8km, Detour: 420km, Direct Return: 460km",
        "vec": [0.00, 420.0, 0.50, 0.40, 4.0, 11.1075, 77.3411, 13.0827, 80.2707, 11.1200, 77.3500, 8.1833, 77.4119, 3.0],
        "explanation": "Nagercoil is at the southern tip of TN, opposite to Chennai northbound return. Zero overlap, high detour distance penalty."
    },
    # 6. Erode -> Madurai (Return: Erode) - Medium Alignment
    {
        "id": 6,
        "driver": "Venkatesh (Mini Truck)",
        "trip": "Madurai to Erode (Return to Madurai)",
        "return_dest": "Madurai (9.9252, 78.1198)",
        "flex": "BALANCED (30km)",
        "candidate": "Turmeric Products (Erode -> Karur)",
        "distances": "Pickup: 6km, Detour: 18km, Direct Return: 195km",
        "vec": [0.90, 18.0, 0.65, 0.88, 1.0, 11.3410, 77.7172, 9.9252, 78.1198, 11.3500, 77.7200, 10.9601, 78.0766, 4.5],
        "explanation": "Karur is directly along the return corridor from Erode to Madurai. Moderate weight utilization."
    },
    # 7. Tirunelveli -> Trichy (Return: Tirunelveli) - High Alignment
    {
        "id": 7,
        "driver": "Arun (Truck)",
        "trip": "Trichy to Tirunelveli (Return to Trichy)",
        "return_dest": "Trichy (10.7905, 78.7047)",
        "flex": "BALANCED (30km)",
        "candidate": "Cement Bags (Tirunelveli -> Madurai)",
        "distances": "Pickup: 10km, Detour: 14km, Direct Return: 300km",
        "vec": [0.95, 14.0, 0.92, 0.95, 0.0, 8.7139, 77.7567, 10.7905, 78.7047, 8.7200, 77.7600, 9.9252, 78.1198, 4.7],
        "explanation": "Madurai is the main midpoint between Tirunelveli and Trichy. High capacity load with excellent trust rating."
    },
    # 8. Vellore -> Chennai (Return: Vellore) - High Overlap
    {
        "id": 8,
        "driver": "Ganesh (Pickup)",
        "trip": "Chennai to Vellore (Return to Chennai)",
        "return_dest": "Chennai (13.0827, 80.2707)",
        "flex": "STRICT (10km)",
        "candidate": "Leather Goods (Vellore -> Kanchipuram)",
        "distances": "Pickup: 4km, Detour: 9km, Direct Return: 140km",
        "vec": [0.94, 9.0, 0.78, 0.92, 2.0, 12.9165, 79.1325, 13.0827, 80.2707, 12.9200, 79.1400, 12.8342, 79.7008, 4.9],
        "explanation": "Kanchipuram is directly on the NH48 route returning from Vellore to Chennai."
    },
    # 9. Thoothukudi -> Coimbatore (Return: Thoothukudi) - High Deviation
    {
        "id": 9,
        "driver": "Manikandan (Truck)",
        "trip": "Coimbatore to Thoothukudi (Return to Coimbatore)",
        "return_dest": "Coimbatore (11.0168, 76.9558)",
        "flex": "FLEXIBLE (70km)",
        "candidate": "Sea Salt (Thoothukudi -> Thanjavur)",
        "distances": "Pickup: 12km, Detour: 165km, Direct Return: 365km",
        "vec": [0.54, 165.0, 0.88, 0.60, 0.0, 8.7642, 78.1348, 11.0168, 76.9558, 8.7800, 78.1400, 10.7870, 79.1378, 3.8],
        "explanation": "Thanjavur requires heading northeast into Delta region, creating a significant 165km detour away from Coimbatore."
    },
    # 10. Dindigul -> Chennai (Return: Dindigul) - High Overlap
    {
        "id": 10,
        "driver": "Karthik (Tempo)",
        "trip": "Chennai to Dindigul (Return to Chennai)",
        "return_dest": "Chennai (13.0827, 80.2707)",
        "flex": "BALANCED (30km)",
        "candidate": "Locks & Hardware (Dindigul -> Trichy)",
        "distances": "Pickup: 5km, Detour: 11km, Direct Return: 430km",
        "vec": [0.97, 11.0, 0.82, 0.94, 3.0, 10.3673, 77.9803, 13.0827, 80.2707, 10.3700, 77.9900, 10.7905, 78.7047, 4.6],
        "explanation": "Trichy is the first major city on the northbound NH45 route returning to Chennai."
    },
    # 11. Kanyakumari -> Madurai (Return: Kanyakumari) - Perfect Alignment
    {
        "id": 11,
        "driver": "Vijay (Mini Truck)",
        "trip": "Madurai to Kanyakumari (Return to Madurai)",
        "return_dest": "Madurai (9.9252, 78.1198)",
        "flex": "BALANCED (30km)",
        "candidate": "Spices (Kanyakumari -> Tirunelveli)",
        "distances": "Pickup: 7km, Detour: 5km, Direct Return: 245km",
        "vec": [0.98, 5.0, 0.75, 0.96, 1.0, 8.0883, 77.5385, 9.9252, 78.1198, 8.0900, 77.5400, 8.7139, 77.7567, 4.9],
        "explanation": "Tirunelveli is 80km north of Kanyakumari on the direct road back to Madurai."
    },
    # 12. Thanjavur -> Trichy (Return: Thanjavur) - Short Distance Return
    {
        "id": 12,
        "driver": "Saravanan (Pickup)",
        "trip": "Trichy to Thanjavur (Return to Trichy)",
        "return_dest": "Trichy (10.7905, 78.7047)",
        "flex": "STRICT (10km)",
        "candidate": "Rice Bags (Thanjavur -> Trichy)",
        "distances": "Pickup: 2km, Detour: 1km, Direct Return: 55km",
        "vec": [0.99, 1.0, 0.95, 0.99, 2.0, 10.7870, 79.1378, 10.7905, 78.7047, 10.7900, 79.1400, 10.7905, 78.7047, 5.0],
        "explanation": "Direct return load from drop city straight back to driver origin city. Maximum efficiency."
    },
    # 13. Hosur -> Chennai (Return: Hosur) - Medium Deviation
    {
        "id": 13,
        "driver": "Dinesh (Truck)",
        "trip": "Chennai to Hosur (Return to Chennai)",
        "return_dest": "Chennai (13.0827, 80.2707)",
        "flex": "FLEXIBLE (70km)",
        "candidate": "Auto Components (Hosur -> Tiruvannamalai)",
        "distances": "Pickup: 14km, Detour: 68km, Direct Return: 300km",
        "vec": [0.77, 68.0, 0.60, 0.75, 0.0, 12.7409, 77.8253, 13.0827, 80.2707, 12.7500, 77.8300, 12.2253, 79.0747, 4.0],
        "explanation": "Tiruvannamalai is south of the main Bengaluru-Chennai highway, requiring a 68km detour."
    },
    # 14. Cuddalore -> Pondicherry (Return: Cuddalore) - High Alignment
    {
        "id": 14,
        "driver": "Babu (Van)",
        "trip": "Pondicherry to Cuddalore (Return to Pondicherry)",
        "return_dest": "Pondicherry (11.9416, 79.8083)",
        "flex": "STRICT (10km)",
        "candidate": "Chemical Drums (Cuddalore -> Pondicherry)",
        "distances": "Pickup: 3km, Detour: 2km, Direct Return: 22km",
        "vec": [0.99, 2.0, 0.85, 0.97, 4.0, 11.7480, 79.7714, 11.9416, 79.8083, 11.7500, 79.7700, 11.9416, 79.8083, 4.8],
        "explanation": "Short coastal return load connecting neighboring industrial hubs."
    },
    # 15. Nagercoil -> Tirunelveli (Return: Nagercoil) - Perfect Alignment
    {
        "id": 15,
        "driver": "Subramani (Tempo)",
        "trip": "Tirunelveli to Nagercoil (Return to Tirunelveli)",
        "return_dest": "Tirunelveli (8.7139, 77.7567)",
        "flex": "BALANCED (30km)",
        "candidate": "Rubber Sheets (Nagercoil -> Valliyur)",
        "distances": "Pickup: 5km, Detour: 4km, Direct Return: 80km",
        "vec": [0.95, 4.0, 0.70, 0.90, 3.0, 8.1833, 77.4119, 8.7139, 77.7567, 8.1900, 77.4200, 8.3813, 77.6105, 4.4],
        "explanation": "Valliyur is midway on the NH44 corridor between Nagercoil and Tirunelveli."
    },
    # 16. Tirupattur -> Salem (Return: Tirupattur) - Medium Deviation
    {
        "id": 16,
        "driver": "Anand (Pickup)",
        "trip": "Salem to Tirupattur (Return to Salem)",
        "return_dest": "Salem (11.6643, 78.1460)",
        "flex": "BALANCED (30km)",
        "candidate": "Granite Tiles (Tirupattur -> Dharmapuri)",
        "distances": "Pickup: 8km, Detour: 25km, Direct Return: 120km",
        "vec": [0.79, 25.0, 0.88, 0.82, 2.0, 12.4917, 78.5678, 11.6643, 78.1460, 12.5000, 78.5700, 12.1211, 78.1582, 4.1],
        "explanation": "Dharmapuri is along the southwest return track toward Salem."
    },
    # 17. Karur -> Coimbatore (Return: Karur) - High Alignment
    {
        "id": 17,
        "driver": "Moorthy (Mini Truck)",
        "trip": "Coimbatore to Karur (Return to Coimbatore)",
        "return_dest": "Coimbatore (11.0168, 76.9558)",
        "flex": "BALANCED (30km)",
        "candidate": "Paper Rolls (Karur -> Tiruppur)",
        "distances": "Pickup: 6km, Detour: 10km, Direct Return: 130km",
        "vec": [0.92, 10.0, 0.80, 0.91, 1.0, 10.9601, 78.0766, 11.0168, 76.9558, 10.9700, 78.0800, 11.1075, 77.3411, 4.7],
        "explanation": "Tiruppur is directly between Karur and Coimbatore along NH81."
    },
    # 18. Rajapalayam -> Madurai (Return: Rajapalayam) - Zero Overlap Deviation
    {
        "id": 18,
        "driver": "Velu (Van)",
        "trip": "Madurai to Rajapalayam (Return to Madurai)",
        "return_dest": "Madurai (9.9252, 78.1198)",
        "flex": "STRICT (10km)",
        "candidate": "Surgical Cotton (Rajapalayam -> Tenkasi)",
        "distances": "Pickup: 6km, Detour: 95km, Direct Return: 90km",
        "vec": [0.00, 95.0, 0.40, 0.50, 4.0, 9.4533, 77.5539, 9.9252, 78.1198, 9.4600, 77.5600, 8.9594, 77.3150, 2.5],
        "explanation": "Tenkasi is south toward Western Ghats, taking driver further away from Madurai."
    },
    # 19. Namakkal -> Trichy (Return: Namakkal) - High Alignment
    {
        "id": 19,
        "driver": "Selvam (Truck)",
        "trip": "Trichy to Namakkal (Return to Trichy)",
        "return_dest": "Trichy (10.7905, 78.7047)",
        "flex": "BALANCED (30km)",
        "candidate": "Poultry Feed (Namakkal -> Musiri)",
        "distances": "Pickup: 4km, Detour: 7km, Direct Return: 85km",
        "vec": [0.92, 7.0, 0.94, 0.93, 0.0, 11.2189, 78.1674, 10.7905, 78.7047, 11.2200, 78.1700, 10.8719, 78.4428, 4.8],
        "explanation": "Musiri is right on the Kaveri river road returning from Namakkal to Trichy."
    },
    # 20. Ramanathapuram -> Madurai (Return: Ramanathapuram) - Medium Overlap
    {
        "id": 20,
        "driver": "Jeyakumar (Tempo)",
        "trip": "Madurai to Ramanathapuram (Return to Madurai)",
        "return_dest": "Madurai (9.9252, 78.1198)",
        "flex": "FLEXIBLE (70km)",
        "candidate": "Dried Fish (Ramanathapuram -> Sivaganga)",
        "distances": "Pickup: 9km, Detour: 22km, Direct Return: 115km",
        "vec": [0.81, 22.0, 0.65, 0.85, 3.0, 9.3639, 78.8395, 9.9252, 78.1198, 9.3700, 78.8400, 9.8471, 78.4842, 4.3],
        "explanation": "Sivaganga is slightly north of the direct Paramakudi highway to Madurai."
    }
]

print("=== RUNNING 20 REALISTIC LOGISTICS SCENARIOS THROUGH ONNX MODEL ===")

results = []

for sc in scenarios:
    vec_tensor = np.array([sc["vec"]], dtype=np.float32)
    feeds = {"float_input": vec_tensor}
    
    res_a = acc_sess.run(None, feeds)
    res_d = del_sess.run(None, feeds)

    prob_a = float(res_a[1][0][1])
    prob_d = float(res_d[1][0][1])

    # Unscaled base score (0..100)
    base_score = prob_a * 60 + prob_d * 40
    
    # Trust factor multiplier
    trust_factor = max(0.2, min(1.2, sc["vec"][13] / 5.0))
    score = base_score * trust_factor
    
    # Penalty for extreme distance deviation > 100km
    dev = sc["vec"][1]
    if dev > 100:
        penalty = max(0.1, 1 - (dev - 100) / 300)
        score = score * penalty
        
    final_score = max(0.0, min(100.0, score))
    
    results.append({
        "id": sc["id"],
        "driver": sc["driver"],
        "trip": sc["trip"],
        "return_dest": sc["return_dest"],
        "flex": sc["flex"],
        "candidate": sc["candidate"],
        "distances": sc["distances"],
        "vec": sc["vec"],
        "prob_a": prob_a,
        "prob_d": prob_d,
        "final_score": final_score,
        "explanation": sc["explanation"]
    })

# Sort by final score descending
results.sort(key=lambda x: x["final_score"], reverse=True)

for r in results:
    print(f"\nScenario #{r['id']} | Rank Score: {r['final_score']:.2f} / 100")
    print(f"Driver: {r['driver']} | Trip: {r['trip']}")
    print(f"Candidate Load: {r['candidate']}")
    print(f"Acceptance Prob: {r['prob_a']:.4f} | Delivery Prob: {r['prob_d']:.4f}")
    print(f"Distances: {r['distances']}")
    print(f"Explanation: {r['explanation']}")
