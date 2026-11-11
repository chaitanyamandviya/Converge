package com.converge.converge_backend.security;

import com.converge.converge_backend.entity.AgencyEntity;
import com.converge.converge_backend.entity.BrandEntity;
import com.converge.converge_backend.entity.UserEntity;
import com.converge.converge_backend.repository.AgencyRepository;
import com.converge.converge_backend.repository.BrandRepository;
import com.converge.converge_backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final BrandRepository brandRepository;
    private final AgencyRepository agencyRepository;

    public JwtAuthenticationFilter(
            JwtService jwtService,
            UserRepository userRepository,
            BrandRepository brandRepository,
            AgencyRepository agencyRepository
    ) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.brandRepository = brandRepository;
        this.agencyRepository = agencyRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);
        final String userEmail;
        try {
            userEmail = jwtService.extractEmail(jwt);
        } catch (Exception e) {
            sendUnauthorized(response, "Invalid or expired session token.");
            return;
        }

        if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserEntity user = userRepository.findByEmail(userEmail).orElse(null);
            if (user == null || !jwtService.isTokenValid(jwt, user.getEmail()) || !isWorkspaceActive(user)) {
                sendUnauthorized(response, "Your Brand or Agency workspace has been deleted or deactivated.");
                return;
            }

            UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                    user.getEmail(),
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole()))
            );
            authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authToken);
        }
        filterChain.doFilter(request, response);
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }

    private boolean isWorkspaceActive(UserEntity user) {
        if ("SYSTEM_ADMIN".equalsIgnoreCase(user.getRole())) {
            return true;
        }
        if (user.getStatus() != null && !"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            return false;
        }
        String email = user.getEmail() != null ? user.getEmail().trim().toLowerCase() : "";
        String org = user.getOrganizationName() != null ? user.getOrganizationName().trim() : "";

        if ("BRAND_MANAGER".equalsIgnoreCase(user.getRole())) {
            BrandEntity brand = user.getBrandId() != null ? brandRepository.findById(user.getBrandId()).orElse(null) : null;
            if (brand == null) {
                brand = brandRepository.findAll().stream()
                        .filter(b -> (b.getPrimaryManagerEmail() != null && b.getPrimaryManagerEmail().trim().equalsIgnoreCase(email))
                                || (b.getContactEmail() != null && b.getContactEmail().trim().equalsIgnoreCase(email))
                                || (!org.isEmpty() && b.getName() != null && b.getName().trim().equalsIgnoreCase(org)))
                        .findFirst()
                        .orElse(null);
            }
            if (brand == null) {
                return false;
            }
            return "ACTIVE".equalsIgnoreCase(brand.getStatus());
        }

        if ("AGENCY_MANAGER".equalsIgnoreCase(user.getRole())) {
            AgencyEntity agency = user.getAgencyId() != null ? agencyRepository.findById(user.getAgencyId()).orElse(null) : null;
            if (agency == null) {
                agency = agencyRepository.findAll().stream()
                        .filter(a -> (a.getContactEmail() != null && a.getContactEmail().trim().equalsIgnoreCase(email))
                                || (!org.isEmpty() && a.getName() != null && a.getName().trim().equalsIgnoreCase(org)))
                        .findFirst()
                        .orElse(null);
            }
            if (agency == null) {
                return false;
            }
            if (agency.getBrandId() != null) {
                BrandEntity parentBrand = brandRepository.findById(agency.getBrandId()).orElse(null);
                if (parentBrand == null || !"ACTIVE".equalsIgnoreCase(parentBrand.getStatus())) {
                    return false;
                }
            }
            return "ACTIVE".equalsIgnoreCase(agency.getStatus());
        }

        return true;
    }
}
