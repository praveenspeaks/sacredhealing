from PIL import Image

def remove_white_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()
    
    new_data = []
    # Tolerance for how "white" a pixel needs to be to turn transparent
    threshold = 230
    
    for item in data:
        r, g, b, a = item
        # If the pixel is mostly white/light, make it transparent
        if r > threshold and g > threshold and b > threshold:
            # Drop alpha entirely for pure white backgrounds
            new_data.append((255, 255, 255, 0))
        else:
            # For anti-aliased edges that are light but not pure white, 
            # we scale the alpha down to create a smooth blend.
            # Calculate how close to white it is (255 is pure white)
            avg = (r + g + b) / 3
            if avg > 150:
                # Fade alpha for mid-tones so edges aren't jagged
                alpha = int(255 - ((avg - 150) / (255 - 150)) * 255)
                # Cap minimum alpha
                if alpha < 0: alpha = 0
                new_data.append((r, g, b, alpha))
            else:
                new_data.append(item)
                
    img.putdata(new_data)
    img.save(output_path, "PNG")

remove_white_background("mandala.png", "mandala.png")
